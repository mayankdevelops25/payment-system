package com.paymentsystem.frauddetectionsystem.services;

import com.paymentsystem.frauddetectionsystem.domain.entity.FraudAlert;
import com.paymentsystem.frauddetectionsystem.domain.enums.RiskLevel;
import com.paymentsystem.frauddetectionsystem.kafka.FraudAlertEventProducer;
import com.paymentsystem.frauddetectionsystem.kafka.event.TransactionEvent;
import com.paymentsystem.frauddetectionsystem.repositories.FraudAlertRepository;
import com.paymentsystem.frauddetectionsystem.rules.FraudRule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for FraudRuleEngine's orchestration: it should run rules in order,
 * stop at the first match (documenting the "first match wins" design — a
 * transaction that trips two rules only ever gets one alert), and only persist
 * and publish when a rule actually matches.
 */
@ExtendWith(MockitoExtension.class)
class FraudRuleEngineTest {

    @Mock
    private FraudRule firstRule;

    @Mock
    private FraudRule secondRule;

    @Mock
    private FraudAlertRepository repository;

    @Mock
    private FraudAlertEventProducer eventProducer;

    @Mock
    private ObjectMapper objectMapper;

    private TransactionEvent event;

    @BeforeEach
    void setUp() {
        event = TransactionEvent.builder()
                .transactionId(UUID.randomUUID())
                .senderId(UUID.randomUUID())
                .receiverId(UUID.randomUUID())
                .amount(BigDecimal.TEN)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Test
    void noRuleMatches_returnsEmptyListAndSavesNothing() {
        when(firstRule.apply(event)).thenReturn(Optional.empty());
        when(secondRule.apply(event)).thenReturn(Optional.empty());

        FraudRuleEngine engine = new FraudRuleEngine(
                List.of(firstRule, secondRule), repository, eventProducer, objectMapper);

        List<FraudAlert> result = engine.analyze(event);

        assertTrue(result.isEmpty());
        verify(repository, never()).save(any());
        verify(eventProducer, never()).publishFraudAlertEvent(any());
    }

    @Test
    void firstRuleMatches_savesAndPublishesWithoutCheckingSecondRule() {
        FraudAlert alert = FraudAlert.builder()
                .transactionId(event.getTransactionId())
                .senderId(event.getSenderId())
                .amount(event.getAmount())
                .reason("First rule triggered")
                .riskLevel(RiskLevel.HIGH)
                .build();

        when(firstRule.apply(event)).thenReturn(Optional.of(alert));
        when(repository.save(alert)).thenReturn(alert);
        when(objectMapper.writeValueAsString(alert)).thenReturn("{}");

        FraudRuleEngine engine = new FraudRuleEngine(
                List.of(firstRule, secondRule), repository, eventProducer, objectMapper);

        List<FraudAlert> result = engine.analyze(event);

        assertEquals(1, result.size());
        assertEquals(alert, result.get(0));
        verify(secondRule, never()).apply(any());
        verify(eventProducer).publishFraudAlertEvent("{}");
    }

    @Test
    void secondRuleMatchesWhenFirstDoesNot_stillSavesAndPublishes() {
        FraudAlert alert = FraudAlert.builder()
                .transactionId(event.getTransactionId())
                .senderId(event.getSenderId())
                .amount(event.getAmount())
                .reason("Second rule triggered")
                .riskLevel(RiskLevel.MEDIUM)
                .build();

        when(firstRule.apply(event)).thenReturn(Optional.empty());
        when(secondRule.apply(event)).thenReturn(Optional.of(alert));
        when(repository.save(alert)).thenReturn(alert);
        when(objectMapper.writeValueAsString(alert)).thenReturn("{}");

        FraudRuleEngine engine = new FraudRuleEngine(
                List.of(firstRule, secondRule), repository, eventProducer, objectMapper);

        List<FraudAlert> result = engine.analyze(event);

        assertEquals(1, result.size());
        verify(repository).save(alert);
        verify(eventProducer).publishFraudAlertEvent("{}");
    }
}
