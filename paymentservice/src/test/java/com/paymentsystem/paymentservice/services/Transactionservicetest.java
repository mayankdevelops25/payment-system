package com.paymentsystem.paymentservice.services;

import com.paymentsystem.paymentservice.domain.entity.Account;
import com.paymentsystem.paymentservice.domain.entity.Transaction;
import com.paymentsystem.paymentservice.domain.enums.AccountStatus;
import com.paymentsystem.paymentservice.domain.enums.Currency;
import com.paymentsystem.paymentservice.domain.enums.TransactionStatus;
import com.paymentsystem.paymentservice.exception.PaymentException;
import com.paymentsystem.paymentservice.outbox.OutboxEvent;
import com.paymentsystem.paymentservice.repositories.AccountRepository;
import com.paymentsystem.paymentservice.repositories.OutboxEventRepository;
import com.paymentsystem.paymentservice.repositories.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the core payment-processing logic: idempotency (Redis-backed),
 * pessimistic locking on accounts, ownership validation, frozen-account checks,
 * currency matching, and insufficient-balance handling.
 *
 * These are pure unit tests with mocked repositories/Redis — no Spring context,
 * no real database. They verify TransactionService's decision logic in isolation.
 */
@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private RedisTemplate<String, String> redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @InjectMocks
    private TransactionService transactionService;

    private Account sender;
    private Account receiver;
    private static final String IDEMPOTENCY_KEY = "test-idem-key";

    @BeforeEach
    void setUp() {
        sender = Account.builder()
                .id(UUID.randomUUID())
                .number("ACC-SENDER-1")
                .owner("Alice")
                .balance(BigDecimal.valueOf(500))
                .status(AccountStatus.ACTIVE)
                .currency(Currency.USD)
                .build();

        receiver = Account.builder()
                .id(UUID.randomUUID())
                .number("ACC-RECEIVER-1")
                .owner("Bob")
                .balance(BigDecimal.valueOf(100))
                .status(AccountStatus.ACTIVE)
                .currency(Currency.USD)
                .build();
    }

    @Test
    void successfulPayment_debitsSenderCreditsReceiverAndSavesTransaction() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);
        when(accountRepository.findByNumberWithLock(sender.getNumber())).thenReturn(Optional.of(sender));
        when(accountRepository.findByNumberWithLock(receiver.getNumber())).thenReturn(Optional.of(receiver));
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> {
            Transaction t = invocation.getArgument(0);
            t.setId(UUID.randomUUID());
            return t;
        });

        Transaction result = transactionService.processPayment(
                sender.getNumber(), receiver.getNumber(), BigDecimal.valueOf(200),
                IDEMPOTENCY_KEY, sender.getId().toString());

        assertEquals(TransactionStatus.SUCCESS, result.getStatus());
        assertEquals(BigDecimal.valueOf(300), sender.getBalance());
        assertEquals(BigDecimal.valueOf(300), receiver.getBalance());
        verify(accountRepository).save(sender);
        verify(accountRepository).save(receiver);
        verify(outboxEventRepository).save(any(OutboxEvent.class));
        verify(valueOperations).set(eq(IDEMPOTENCY_KEY), anyString(), eq(24L), eq(TimeUnit.HOURS));
    }

    @Test
    void duplicateRequest_stillProcessing_throwsWithoutTouchingAccounts() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(false);
        when(valueOperations.get(IDEMPOTENCY_KEY)).thenReturn("PROCESSING");

        assertThrows(PaymentException.class, () -> transactionService.processPayment(
                sender.getNumber(), receiver.getNumber(), BigDecimal.valueOf(50),
                IDEMPOTENCY_KEY, sender.getId().toString()));

        verify(accountRepository, never()).findByNumberWithLock(anyString());
    }

    @Test
    void duplicateRequest_alreadyCompleted_returnsCachedTransactionWithoutReprocessing() {
        UUID existingTransactionId = UUID.randomUUID();
        Transaction existing = new Transaction();
        existing.setId(existingTransactionId);
        existing.setStatus(TransactionStatus.SUCCESS);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(false);
        when(valueOperations.get(IDEMPOTENCY_KEY)).thenReturn(existingTransactionId.toString());
        when(transactionRepository.findById(existingTransactionId)).thenReturn(Optional.of(existing));

        Transaction result = transactionService.processPayment(
                sender.getNumber(), receiver.getNumber(), BigDecimal.valueOf(50),
                IDEMPOTENCY_KEY, sender.getId().toString());

        assertEquals(existingTransactionId, result.getId());
        verify(accountRepository, never()).findByNumberWithLock(anyString());
        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    void selfTransfer_throwsBeforeTouchingAccounts() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);

        assertThrows(PaymentException.class, () -> transactionService.processPayment(
                sender.getNumber(), sender.getNumber(), BigDecimal.valueOf(50),
                IDEMPOTENCY_KEY, sender.getId().toString()));

        verify(accountRepository, never()).findByNumberWithLock(anyString());
    }

    @Test
    void insufficientBalance_throwsAndLeavesBalancesUnchanged() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);
        when(accountRepository.findByNumberWithLock(sender.getNumber())).thenReturn(Optional.of(sender));
        when(accountRepository.findByNumberWithLock(receiver.getNumber())).thenReturn(Optional.of(receiver));

        BigDecimal originalSenderBalance = sender.getBalance();
        BigDecimal originalReceiverBalance = receiver.getBalance();

        assertThrows(PaymentException.class, () -> transactionService.processPayment(
                sender.getNumber(), receiver.getNumber(), BigDecimal.valueOf(9999),
                IDEMPOTENCY_KEY, sender.getId().toString()));

        assertEquals(originalSenderBalance, sender.getBalance());
        assertEquals(originalReceiverBalance, receiver.getBalance());
        verify(accountRepository, never()).save(any(Account.class));
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void unauthorizedCaller_throwsWhenUserIdDoesNotMatchSenderAccount() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);
        when(accountRepository.findByNumberWithLock(sender.getNumber())).thenReturn(Optional.of(sender));
        when(accountRepository.findByNumberWithLock(receiver.getNumber())).thenReturn(Optional.of(receiver));

        String someoneElsesUserId = UUID.randomUUID().toString();

        assertThrows(PaymentException.class, () -> transactionService.processPayment(
                sender.getNumber(), receiver.getNumber(), BigDecimal.valueOf(50),
                IDEMPOTENCY_KEY, someoneElsesUserId));

        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    void frozenSenderAccount_throwsAndBlocksPayment() {
        sender.setStatus(AccountStatus.FROZEN);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);
        when(accountRepository.findByNumberWithLock(sender.getNumber())).thenReturn(Optional.of(sender));
        when(accountRepository.findByNumberWithLock(receiver.getNumber())).thenReturn(Optional.of(receiver));

        assertThrows(PaymentException.class, () -> transactionService.processPayment(
                sender.getNumber(), receiver.getNumber(), BigDecimal.valueOf(50),
                IDEMPOTENCY_KEY, sender.getId().toString()));

        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    void frozenReceiverAccount_throwsAndBlocksPayment() {
        receiver.setStatus(AccountStatus.FROZEN);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);
        when(accountRepository.findByNumberWithLock(sender.getNumber())).thenReturn(Optional.of(sender));
        when(accountRepository.findByNumberWithLock(receiver.getNumber())).thenReturn(Optional.of(receiver));

        assertThrows(PaymentException.class, () -> transactionService.processPayment(
                sender.getNumber(), receiver.getNumber(), BigDecimal.valueOf(50),
                IDEMPOTENCY_KEY, sender.getId().toString()));

        verify(accountRepository, never()).save(any(Account.class));
    }

    @Test
    void currencyMismatch_throwsAndBlocksPayment() {
        receiver.setCurrency(Currency.EUR);

        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(eq(IDEMPOTENCY_KEY), eq("PROCESSING"), anyLong(), any(TimeUnit.class)))
                .thenReturn(true);
        when(accountRepository.findByNumberWithLock(sender.getNumber())).thenReturn(Optional.of(sender));
        when(accountRepository.findByNumberWithLock(receiver.getNumber())).thenReturn(Optional.of(receiver));

        assertThrows(PaymentException.class, () -> transactionService.processPayment(
                sender.getNumber(), receiver.getNumber(), BigDecimal.valueOf(50),
                IDEMPOTENCY_KEY, sender.getId().toString()));

        verify(accountRepository, never()).save(any(Account.class));
    }
}