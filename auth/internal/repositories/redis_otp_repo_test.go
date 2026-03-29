package repositories

import (
	"context"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test configuration
const (
	testRedisAddr = "localhost:6379"
	testRedisDB   = 15 // Use DB 15 for testing to avoid conflicts
)

// setupTestRedis creates a Redis client for testing
func setupTestRedis(t *testing.T) *redis.Client {
	// Skip if Redis is not available
	if testing.Short() {
		t.Skip("Skipping Redis integration tests in short mode")
	}

	client := redis.NewClient(&redis.Options{
		Addr: testRedisAddr,
		DB:   testRedisDB,
	})

	// Test connection
	ctx := context.Background()
	_, err := client.Ping(ctx).Result()
	if err != nil {
		t.Skipf("Redis not available at %s: %v", testRedisAddr, err)
	}

	// Clear test database
	client.FlushDB(ctx)

	return client
}

// teardownTestRedis cleans up Redis test data
func teardownTestRedis(t *testing.T, client *redis.Client) {
	if client != nil {
		client.FlushDB(context.Background())
		client.Close()
	}
}

func TestRedisOTPRepository_StoreAndVerify(t *testing.T) {
	client := setupTestRedis(t)
	defer teardownTestRedis(t, client)

	repo := NewRedisOTPRepository(client)
	phone := "+919876543210"
	otp := "1234"
	expireAt := time.Now().Add(5 * time.Minute)

	t.Run("store and verify valid OTP", func(t *testing.T) {
		// Store OTP
		err := repo.StoreOTP(phone, otp, expireAt)
		require.NoError(t, err)

		// Verify OTP
		valid := repo.VerifyOTP(phone, otp)
		assert.True(t, valid)

		// OTP should be consumed after verification
		_, _, exists := repo.GetOTPInfo(phone)
		assert.False(t, exists)
	})

	t.Run("verify invalid OTP", func(t *testing.T) {
		// Store OTP
		err := repo.StoreOTP(phone, otp, expireAt)
		require.NoError(t, err)

		// Try wrong OTP
		valid := repo.VerifyOTP(phone, "0000")
		assert.False(t, valid)

		// OTP should still exist
		_, _, exists := repo.GetOTPInfo(phone)
		assert.True(t, exists)
	})

	t.Run("verify expired OTP", func(t *testing.T) {
		// Store OTP with very short expiration
		expiredTime := time.Now().Add(1 * time.Second)
		err := repo.StoreOTP(phone, otp, expiredTime)
		require.NoError(t, err)

		// Wait for expiration
		time.Sleep(2 * time.Second)

		// Try to verify expired OTP
		valid := repo.VerifyOTP(phone, otp)
		assert.False(t, valid)
	})
}

func TestRedisOTPRepository_GetOTPInfo(t *testing.T) {
	client := setupTestRedis(t)
	defer teardownTestRedis(t, client)

	repo := NewRedisOTPRepository(client)
	phone := "+919876543210"
	otp := "1234"
	expireAt := time.Now().Add(5 * time.Minute)

	t.Run("get existing OTP info", func(t *testing.T) {
		// Store OTP first
		err := repo.StoreOTP(phone, otp, expireAt)
		require.NoError(t, err)

		// Get OTP info
		storedOTP, storedExpireAt, exists := repo.GetOTPInfo(phone)
		assert.True(t, exists)
		assert.Equal(t, otp, storedOTP)
		assert.WithinDuration(t, expireAt, storedExpireAt, 2*time.Second)
	})

	t.Run("get non-existent OTP info", func(t *testing.T) {
		phone := "+919876543211"

		// Get info for non-existent OTP
		_, _, exists := repo.GetOTPInfo(phone)
		assert.False(t, exists)
	})
}

func TestRedisOTPRepository_InvalidateOTP(t *testing.T) {
	client := setupTestRedis(t)
	defer teardownTestRedis(t, client)

	repo := NewRedisOTPRepository(client)
	phone := "+919876543210"
	otp := "1234"
	expireAt := time.Now().Add(5 * time.Minute)

	t.Run("invalidate existing OTP", func(t *testing.T) {
		// Store OTP first
		err := repo.StoreOTP(phone, otp, expireAt)
		require.NoError(t, err)

		// Invalidate OTP
		err = repo.InvalidateOTP(phone)
		assert.NoError(t, err)

		// Verify OTP was invalidated
		_, _, exists := repo.GetOTPInfo(phone)
		assert.False(t, exists)
	})
}
