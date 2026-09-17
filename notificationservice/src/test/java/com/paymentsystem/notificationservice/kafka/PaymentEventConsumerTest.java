package com.paymentsystem.notificationservice.kafka;

import com.paymentsystem.notificationservice.enums.TransactionStatus;
import com.paymentsystem.notificationservice.kafka.event.TransactionEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for PaymentEventConsumer. The main behavior worth verifying here
 * isn't the happy path (just a log line) — it's that a malformed/unparseable
 * Kafka message is caught and logged rather than thrown, since an uncaught
 * exception in a @KafkaListener method would otherwise repeatedly crash the
 * listener container on that same message.
 */
@ExtendWith(MockitoExtension.class)
class PaymentEventConsumerTest {

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private PaymentEventConsumer consumer;

    @Test
    void validMessage_deserializesAndDoesNotThrow() {
        TransactionEvent event = TransactionEvent.builder()
                .transactionId(UUID.randomUUID())
                .senderId(UUID.randomUUID())
                .receiverId(UUID.randomUUID())
                .amount(BigDecimal.valueOf(100))
                .status(TransactionStatus.SUCCESS)
                .timestamp(LocalDateTime.now())
                .build();

        String message = "{\"some\":\"json\"}";
        when(objectMapper.readValue(message, TransactionEvent.class)).thenReturn(event);

        assertDoesNotThrow(() -> consumer.consume(message));

        verify(objectMapper).readValue(message, TransactionEvent.class);
    }

    @Test
    void malformedMessage_isCaughtAndDoesNotPropagate() {
        String badMessage = "not valid json";
        when(objectMapper.readValue(badMessage, TransactionEvent.class))
                .thenThrow(new RuntimeException("parse error"));

        // The listener must never let a bad message crash the consumer thread —
        // this call should complete silently (the error is only logged).
        assertDoesNotThrow(() -> consumer.consume(badMessage));
    }
}
