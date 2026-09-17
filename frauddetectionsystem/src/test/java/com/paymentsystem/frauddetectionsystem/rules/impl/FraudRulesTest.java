package com.paymentsystem.frauddetectionsystem.rules.impl;

import com.paymentsystem.frauddetectionsystem.domain.entity.FraudAlert;
import com.paymentsystem.frauddetectionsystem.domain.enums.Currency;
import com.paymentsystem.frauddetectionsystem.domain.enums.RiskLevel;
import com.paymentsystem.frauddetectionsystem.kafka.event.TransactionEvent;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Each fraud rule is a small, pure function of a TransactionEvent — no mocking
 * needed. These tests exist specifically because every rule except
 * LargeTransactionRule previously had a copy-pasted, incorrect "reason" string
 * ("Suspicious Large Transaction") regardless of what it actually detected —
 * asserting on the reason text here would have caught that immediately.
 */
class FraudRulesTest {

    private TransactionEvent baseEvent(BigDecimal amount, String currency) {
        return TransactionEvent.builder()
                .transactionId(UUID.randomUUID())
                .senderId(UUID.randomUUID())
                .receiverId(UUID.randomUUID())
                .amount(amount)
                .currency(Currency.valueOf(currency))
                .timestamp(LocalDateTime.now())
                .build();
    }

    @Nested
    class LargeTransactionRuleTests {
        private final LargeTransactionRule rule = new LargeTransactionRule();

        @Test
        void amountAtOrAboveCurrencyThreshold_flagsHighRisk() {
            TransactionEvent event = baseEvent(new BigDecimal("10000"), "USD");
            Optional<FraudAlert> result = rule.apply(event);

            assertTrue(result.isPresent());
            assertEquals(RiskLevel.HIGH, result.get().getRiskLevel());
            assertEquals("Suspicious Large Transaction", result.get().getReason());
        }

        @Test
        void amountBelowCurrencyThreshold_doesNotFlag() {
            TransactionEvent event = baseEvent(new BigDecimal("500"), "USD");
            assertTrue(rule.apply(event).isEmpty());
        }
    }

    @Nested
    class SelfTransferRuleTests {
        private final SelfTransferRule rule = new SelfTransferRule();

        @Test
        void senderEqualsReceiver_flagsMediumRisk() {
            UUID sameId = UUID.randomUUID();
            TransactionEvent event = TransactionEvent.builder()
                    .transactionId(UUID.randomUUID())
                    .senderId(sameId)
                    .receiverId(sameId)
                    .amount(BigDecimal.TEN)
                    .currency(Currency.USD)
                    .timestamp(LocalDateTime.now())
                    .build();

            Optional<FraudAlert> result = rule.apply(event);
            assertTrue(result.isPresent());
            assertEquals(RiskLevel.MEDIUM, result.get().getRiskLevel());
            assertEquals("Self-transfer detected", result.get().getReason());
        }

        @Test
        void differentSenderAndReceiver_doesNotFlag() {
            TransactionEvent event = baseEvent(BigDecimal.TEN, "USD");
            assertTrue(rule.apply(event).isEmpty());
        }
    }

    @Nested
    class RoundNumbersRuleTests {
        private final RoundNumbersRule rule = new RoundNumbersRule();

        @Test
        void wholeNumberAmount_flagsLowRisk() {
            TransactionEvent event = baseEvent(new BigDecimal("500"), "USD");
            Optional<FraudAlert> result = rule.apply(event);

            assertTrue(result.isPresent());
            assertEquals(RiskLevel.LOW, result.get().getRiskLevel());
            assertEquals("Suspiciously round transaction amount", result.get().getReason());
        }

        @Test
        void amountWithCents_doesNotFlag() {
            TransactionEvent event = baseEvent(new BigDecimal("500.50"), "USD");
            assertTrue(rule.apply(event).isEmpty());
        }
    }

    @Nested
    class ThresholdGamingRuleTests {
        private final ThresholdGamingRule rule = new ThresholdGamingRule();

        @Test
        void exactlyNineNineNineNine_flagsHighRisk() {
            TransactionEvent event = baseEvent(new BigDecimal("9999"), "USD");
            Optional<FraudAlert> result = rule.apply(event);

            assertTrue(result.isPresent());
            assertEquals(RiskLevel.HIGH, result.get().getRiskLevel());
            assertEquals("Amount appears designed to evade a reporting threshold", result.get().getReason());
        }

        @Test
        void slightlyDifferentAmount_doesNotFlag() {
            TransactionEvent event = baseEvent(new BigDecimal("9998"), "USD");
            assertTrue(rule.apply(event).isEmpty());
        }
    }

    @Nested
    class SystemManipulationRuleTests {
        private final SystemManipulationRule rule = new SystemManipulationRule();

        @Test
        void zeroAmount_flagsHighRisk() {
            TransactionEvent event = baseEvent(BigDecimal.ZERO, "USD");
            Optional<FraudAlert> result = rule.apply(event);

            assertTrue(result.isPresent());
            assertEquals(RiskLevel.HIGH, result.get().getRiskLevel());
            assertEquals("Non-positive transaction amount (possible system manipulation)", result.get().getReason());
        }

        @Test
        void negativeAmount_flagsHighRisk() {
            TransactionEvent event = baseEvent(new BigDecimal("-50"), "USD");
            assertTrue(rule.apply(event).isPresent());
        }

        @Test
        void positiveAmount_doesNotFlag() {
            TransactionEvent event = baseEvent(new BigDecimal("50.25"), "USD");
            assertTrue(rule.apply(event).isEmpty());
        }
    }
}
