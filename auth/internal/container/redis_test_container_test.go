package container

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedisTestContainer_Creation(t *testing.T) {
	if !IsRedisAvailable() {
		t.Skip("Redis not available, skipping RedisTestContainer tests")
	}

	container, err := NewRedisTestContainer()
	require.NoError(t, err)
	defer container.Shutdown()

	// Test that container is properly initialized
	assert.NotNil(t, container)
	assert.NotNil(t, container.GetRedisClient())
	assert.NotNil(t, container.GetUserRepository())
	assert.NotNil(t, container.GetOTPRepository())
}

func TestRedisTestContainer_OTPIntegration(t *testing.T) {
	if !IsRedisAvailable() {
		t.Skip("Redis not available, skipping RedisTestContainer tests")
	}

	container, err := NewRedisTestContainer()
	require.NoError(t, err)
	defer container.Shutdown()

	// Clear any existing data
	container.ClearAllData()

	// Test OTP operations with real Redis
	otpRepo := container.GetOTPRepository()
	phone := "+919876543210"
	otp := "1234"
	expireAt := time.Now().Add(5 * time.Minute)

	// Store OTP
	err = otpRepo.StoreOTP(phone, otp, expireAt)
	assert.NoError(t, err)

	// Verify OTP exists
	storedOTP, storedExpireAt, exists := otpRepo.GetOTPInfo(phone)
	assert.True(t, exists)
	assert.Equal(t, otp, storedOTP)
	assert.WithinDuration(t, expireAt, storedExpireAt, 2*time.Second)

	// Verify OTP
	valid := otpRepo.VerifyOTP(phone, otp)
	assert.True(t, valid)

	// OTP should be consumed after verification
	_, _, exists = otpRepo.GetOTPInfo(phone)
	assert.False(t, exists)
}

func TestRedisTestContainer_AuthServiceIntegration(t *testing.T) {
	if !IsRedisAvailable() {
		t.Skip("Redis not available, skipping RedisTestContainer tests")
	}

	// Set required environment variables for JWT generation
	originalSecretKey := os.Getenv("SECRET_KEY_BASE")
	os.Setenv("SECRET_KEY_BASE", "test_secret_key_for_integration_testing")
	defer func() {
		if originalSecretKey == "" {
			os.Unsetenv("SECRET_KEY_BASE")
		} else {
			os.Setenv("SECRET_KEY_BASE", originalSecretKey)
		}
	}()

	container, err := NewRedisTestContainer()
	require.NoError(t, err)
	defer container.Shutdown()

	// Clear any existing data
	container.ClearAllData()

	// Test auth service with real Redis
	authService := container.Services.Auth
	phone := "+19999999999" // Use test phone number
	expectedOTP := "7415"   // Fixed OTP for test phone

	// Request OTP
	err = authService.RequestOTP(phone)
	assert.NoError(t, err)

	// Verify OTP with auth service
	user, token, err := authService.VerifyOTP(phone, expectedOTP)
	assert.NoError(t, err)
	assert.NotNil(t, user)
	assert.NotEmpty(t, token)
	assert.Equal(t, phone, user.Phone)
}

func TestIsRedisAvailable(t *testing.T) {
	available := IsRedisAvailable()
	t.Logf("Redis available: %v", available)
	// This test just logs the availability, doesn't fail
}
