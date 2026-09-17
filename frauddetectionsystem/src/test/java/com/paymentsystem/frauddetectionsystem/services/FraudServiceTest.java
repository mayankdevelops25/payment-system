package com.paymentsystem.frauddetectionsystem.services;

import com.paymentsystem.frauddetectionsystem.domain.entity.FraudAlert;
import com.paymentsystem.frauddetectionsystem.domain.enums.FraudStatus;
import com.paymentsystem.frauddetectionsystem.domain.enums.RiskLevel;
import com.paymentsystem.frauddetectionsystem.outbox.OutboxEvent;
import com.paymentsystem.frauddetectionsystem.repositories.FraudAlertRepository;
import com.paymentsystem.frauddetectionsystem.repositories.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

/**
 * Unit tests for FraudService's admin review flow (approve/reject), covering
 * the status transition, reviewer/timestamp stamping, and the outbox event
 * that notifies payment-service to unfreeze/keep-frozen the account.
 */
@ExtendWith(MockitoExtension.class)
class FraudServiceTest {

    @Mock
    private FraudAlertRepository fraudAlertRepository;

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private FraudService fraudService;

    private FraudAlert alert;
    private UUID alertId;
    private String reviewerId;

    @BeforeEach
    void setUp() {
        alertId = UUID.randomUUID();
        reviewerId = UUID.randomUUID().toString();
        alert = FraudAlert.builder()
                .id(alertId)
                .transactionId(UUID.randomUUID())
                .senderId(UUID.randomUUID())
                .amount(BigDecimal.valueOf(500))
                .reason("Suspicious Large Transaction")
                .riskLevel(RiskLevel.HIGH)
                .build();
    }

    @Test
    void approve_setsStatusApprovedAndPublishesOutboxEvent() {
        when(fraudAlertRepository.findById(alertId)).thenReturn(Optional.of(alert));
        when(fraudAlertRepository.save(any(FraudAlert.class))).thenAnswer(inv -> inv.getArgument(0));
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        FraudAlert result = fraudService.approve(alertId, reviewerId);

        assertEquals(FraudStatus.APPROVED, result.getStatus());
        assertEquals(UUID.fromString(reviewerId), result.getReviewedBy());
        assertNotNull(result.getReviewedAt());

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxEventRepository).save(captor.capture());
        assertEquals("{}", captor.getValue().getPayload());
    }

    @Test
    void reject_setsStatusRejectedAndPublishesOutboxEvent() {
        when(fraudAlertRepository.findById(alertId)).thenReturn(Optional.of(alert));
        when(fraudAlertRepository.save(any(FraudAlert.class))).thenAnswer(inv -> inv.getArgument(0));
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");

        FraudAlert result = fraudService.reject(alertId, reviewerId);

        assertEquals(FraudStatus.REJECTED, result.getStatus());
        verify(outboxEventRepository).save(any(OutboxEvent.class));
    }

    @Test
    void review_alertNotFound_throwsAndNeverTouchesOutbox() {
        UUID missingId = UUID.randomUUID();
        when(fraudAlertRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> fraudService.approve(missingId, reviewerId));

        verify(outboxEventRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void review_serializationFails_wrapsAsRuntimeException() {
        when(fraudAlertRepository.findById(alertId)).thenReturn(Optional.of(alert));
        when(fraudAlertRepository.save(any(FraudAlert.class))).thenAnswer(inv -> inv.getArgument(0));
        when(objectMapper.writeValueAsString(any())).thenThrow(new RuntimeException("serialization boom"));

        assertThrows(RuntimeException.class, () -> fraudService.approve(alertId, reviewerId));
    }
}
