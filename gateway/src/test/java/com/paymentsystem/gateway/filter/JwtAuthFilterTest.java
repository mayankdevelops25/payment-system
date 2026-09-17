package com.paymentsystem.gateway.filter;

import com.paymentsystem.gateway.util.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for JwtAuthFilter, the gateway's single point of authentication.
 * Uses real MockServerWebExchange/MockServerHttpRequest objects rather than
 * mocking the fluent request-mutation builder chain, since that chain is
 * awkward and unreliable to mock directly.
 *
 * Covers: public /auth/** routes bypass the check entirely, missing/malformed
 * Authorization headers are rejected with 401 without ever calling the chain,
 * an invalid JWT is rejected, and a valid JWT results in the downstream
 * request having trusted X-User-Id/X-User-Role headers injected — with any
 * client-supplied values for those same headers stripped first.
 */
@ExtendWith(MockitoExtension.class)
class JwtAuthFilterTest {

    @Mock
    private JwtUtil jwtUtil;

    private JwtAuthFilter filter;

    // Captures whatever exchange the filter actually passed down the chain,
    // so we can inspect the mutated request's headers afterward.
    private final AtomicReference<ServerWebExchange> capturedExchange = new AtomicReference<>();
    private final WebFilterChain capturingChain = exchange -> {
        capturedExchange.set(exchange);
        return Mono.empty();
    };

    @BeforeEach
    void setUp() {
        filter = new JwtAuthFilter(jwtUtil);
        ReflectionTestUtils.setField(filter, "API_PREFIX", "/api/v1");
    }

    @Test
    void publicAuthRoute_bypassesAuthEntirely() {
        MockServerHttpRequest request = MockServerHttpRequest.post("/api/v1/auth/login").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(filter.filter(exchange, capturingChain))
                .verifyComplete();

        assertEquals(exchange, capturedExchange.get());
        verify(jwtUtil, never()).isTokenValid(anyString());
    }

    @Test
    void missingAuthorizationHeader_returns401WithoutCallingChain() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/payments").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(filter.filter(exchange, capturingChain))
                .verifyComplete();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(capturedExchange.get());
    }

    @Test
    void authorizationHeaderWithoutBearerPrefix_returns401() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/payments")
                .header("Authorization", "Basic somecreds")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(filter.filter(exchange, capturingChain))
                .verifyComplete();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(capturedExchange.get());
    }

    @Test
    void invalidToken_returns401WithoutCallingChain() {
        when(jwtUtil.isTokenValid("bad-token")).thenReturn(false);

        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/payments")
                .header("Authorization", "Bearer bad-token")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(filter.filter(exchange, capturingChain))
                .verifyComplete();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        assertNull(capturedExchange.get());
    }

    @Test
    void validToken_injectsTrustedHeadersAndStripsClientSuppliedOnes() {
        when(jwtUtil.isTokenValid("good-token")).thenReturn(true);
        when(jwtUtil.extractUserId("good-token")).thenReturn("user-123");
        when(jwtUtil.extractRole("good-token")).thenReturn("ADMIN");

        // Client tries to spoof its own identity via these headers directly.
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/payments")
                .header("Authorization", "Bearer good-token")
                .header("X-User-Id", "attacker-supplied-id")
                .header("X-User-Role", "ADMIN-SPOOFED")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(filter.filter(exchange, capturingChain))
                .verifyComplete();

        ServerWebExchange downstream = capturedExchange.get();
        assertEquals("user-123", downstream.getRequest().getHeaders().getFirst("X-User-Id"));
        assertEquals("ADMIN", downstream.getRequest().getHeaders().getFirst("X-User-Role"));
        // Only one value should be present for each — confirms the old
        // client-supplied header was actually removed, not just appended to.
        assertEquals(1, downstream.getRequest().getHeaders().get("X-User-Id").size());
        assertEquals(1, downstream.getRequest().getHeaders().get("X-User-Role").size());
    }
}
