package repositories

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisOTPRepository implements OTPRepository interface for Redis
type RedisOTPRepository struct {
	client *redis.Client
	ctx    context.Context
}

// NewRedisOTPRepository creates a new Redis OTP repository
func NewRedisOTPRepository(client *redis.Client) OTPRepository {
	return &RedisOTPRepository{
		client: client,
		ctx:    context.Background(),
	}
}

// StoreOTP stores an OTP with expiration time
func (r *RedisOTPRepository) StoreOTP(phone, otp string, expireAt time.Time) error {
	key := fmt.Sprintf("otp:%s", phone)
	value := fmt.Sprintf("%s:%d", otp, expireAt.Unix())
	duration := time.Until(expireAt)

	if duration <= 0 {
		return fmt.Errorf("OTP expiration time is in the past")
	}

	err := r.client.Set(r.ctx, key, value, duration).Err()
	if err != nil {
		return fmt.Errorf("error storing OTP in Redis: %w", err)
	}

	return nil
}

// VerifyOTP verifies an OTP and consumes it if valid
func (r *RedisOTPRepository) VerifyOTP(phone, otp string) bool {
	key := fmt.Sprintf("otp:%s", phone)

	val, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		// OTP not found or Redis error
		return false
	}

	// Split the value by colon to separate OTP and timestamp
	parts := strings.Split(val, ":")
	if len(parts) != 2 {
		return false
	}

	storedOTP := parts[0]
	expireAt, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return false
	}

	// Check if OTP matches
	if storedOTP != otp {
		return false
	}

	// Check if OTP has expired
	if time.Now().Unix() > expireAt {
		// Clean up expired OTP
		r.client.Del(r.ctx, key)
		return false
	}

	// OTP is valid, consume it (delete from Redis)
	r.client.Del(r.ctx, key)
	return true
}

// InvalidateOTP invalidates/deletes an OTP
func (r *RedisOTPRepository) InvalidateOTP(phone string) error {
	key := fmt.Sprintf("otp:%s", phone)

	err := r.client.Del(r.ctx, key).Err()
	if err != nil {
		return fmt.Errorf("error invalidating OTP in Redis: %w", err)
	}

	return nil
}

// Additional helper methods for testing and monitoring

// GetOTPInfo returns OTP information without consuming it (for testing)
func (r *RedisOTPRepository) GetOTPInfo(phone string) (string, time.Time, bool) {
	key := fmt.Sprintf("otp:%s", phone)

	val, err := r.client.Get(r.ctx, key).Result()
	if err != nil {
		return "", time.Time{}, false
	}

	parts := strings.Split(val, ":")
	if len(parts) != 2 {
		return "", time.Time{}, false
	}

	storedOTP := parts[0]
	expireAt, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return "", time.Time{}, false
	}

	return storedOTP, time.Unix(expireAt, 0), true
}

// GetOTPTTL returns the remaining TTL for an OTP
func (r *RedisOTPRepository) GetOTPTTL(phone string) (time.Duration, error) {
	key := fmt.Sprintf("otp:%s", phone)

	ttl, err := r.client.TTL(r.ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("error getting OTP TTL: %w", err)
	}

	return ttl, nil
}
