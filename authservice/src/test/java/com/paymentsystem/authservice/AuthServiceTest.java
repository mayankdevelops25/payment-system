package com.paymentsystem.authservice.service;

import com.paymentsystem.authservice.domain.entity.User;
import com.paymentsystem.authservice.domain.enums.Currency;
import com.paymentsystem.authservice.domain.enums.Role;
import com.paymentsystem.authservice.kafka.event.UserRegisterdProducer;
import com.paymentsystem.authservice.kafka.event.UserRegisteredEvent;
import com.paymentsystem.authservice.mappers.UserMapper;
import com.paymentsystem.authservice.repositories.UserRepository;
import com.paymentsystem.authservice.security.AuthUserDetailsService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.SecretKey;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for AuthService: registration (including the email-lowercasing and
 * default-currency behavior), authentication, and JWT generation/validation.
 * All dependencies are mocked — no real database, no Spring context.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private AuthUserDetailsService userDetailsService;

    @Mock
    private UserRegisterdProducer userRegisterdProducer;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private UserMapper userMapper;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthService authService;

    // A valid base64-encoded 256-bit key, purely for test signing — not a real secret.
    private static final String TEST_SECRET =
            Base64.getEncoder().encodeToString("test-secret-key-only-for-unit-tests-32b".getBytes());

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "SECRET_KEY", TEST_SECRET);
    }

    private User buildUser(String email, Currency currency) {
        return User.builder()
                .id(UUID.randomUUID())
                .email(email)
                .password("encodedPw")
                .name("Test User")
                .role(Role.USER)
                .currency(currency)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void register_newUser_lowercasesEmailAndPublishesEvent() {
        String rawEmail = "Alice@Example.com";
        User saved = buildUser("alice@example.com", Currency.USD);

        when(userRepository.existsByEmail("alice@example.com")).thenReturn(false);
        when(passwordEncoder.encode("pw123")).thenReturn("encodedPw");
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(userMapper.toUserRegisteredEvent(saved)).thenReturn(
                UserRegisteredEvent.builder().id(saved.getId()).name(saved.getName())
                        .email(saved.getEmail()).currency(saved.getCurrency()).build());
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        User result = authService.register("Test User", rawEmail, "pw123", Currency.USD);

        assertEquals("alice@example.com", result.getEmail());
        verify(userRegisterdProducer).publishEvent(anyString());

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals("alice@example.com", captor.getValue().getEmail());
        assertEquals("encodedPw", captor.getValue().getPassword());
    }

    @Test
    void register_nullCurrency_defaultsToUSD() {
        User saved = buildUser("bob@example.com", Currency.USD);

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPw");
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(userMapper.toUserRegisteredEvent(any())).thenReturn(UserRegisteredEvent.builder().build());
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        authService.register("Bob", "bob@example.com", "pw123", null);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals(Currency.USD, captor.getValue().getCurrency());
    }

    @Test
    void register_emailAlreadyExists_throwsAndNeverSaves() {
        when(userRepository.existsByEmail("taken@example.com")).thenReturn(true);

        assertThrows(RuntimeException.class, () ->
                authService.register("Someone", "taken@example.com", "pw123", Currency.USD));

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void register_dataIntegrityViolationOnSave_wrappedAsFriendlyException() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPw");
        when(userRepository.save(any(User.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        RuntimeException ex = assertThrows(RuntimeException.class, () ->
                authService.register("Someone", "race@example.com", "pw123", Currency.USD));

        assertEquals(true, ex.getMessage().contains("already exists"));
    }

    @Test
    void authenticate_validCredentials_returnsUser() {
        User user = buildUser("alice@example.com", Currency.USD);
        when(userRepository.findByEmail("alice@example.com")).thenReturn(Optional.of(user));

        User result = authService.authenticate("alice@example.com", "pw123");

        assertEquals(user, result);
    }

    @Test
    void authenticate_badCredentials_throwsFromAuthenticationManager() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad creds"));

        assertThrows(BadCredentialsException.class, () ->
                authService.authenticate("alice@example.com", "wrongpw"));
    }

    @Test
    void authenticate_userDisappearsAfterAuth_throwsRuntimeException() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () ->
                authService.authenticate("ghost@example.com", "pw123"));
    }

    @Test
    void generateToken_producesTokenWithCorrectClaims() {
        User user = buildUser("alice@example.com", Currency.USD);

        String token = authService.generateToken(user);
        assertNotNull(token);

        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(TEST_SECRET));
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();

        assertEquals(user.getId().toString(), claims.getSubject());
        assertEquals(user.getEmail(), claims.get("email"));
        assertEquals(user.getRole().name(), claims.get("role"));
    }

    @Test
    void validateToken_malformedToken_throws() {
        assertThrows(Exception.class, () -> authService.validateToken("not-a-valid-jwt"));
    }
}
