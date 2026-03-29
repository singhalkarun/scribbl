package repositories

import (
	"sync"
	"time"
)

// OTPEntry represents an OTP entry in mock storage
type OTPEntry struct {
	OTP      string
	ExpireAt int64 // Unix timestamp
}

// MockOTPRepository implements OTPRepository interface for testing
type MockOTPRepository struct {
	otps  map[string]OTPEntry
	mutex sync.RWMutex
}

// NewMockOTPRepository creates a new mock OTP repository
func NewMockOTPRepository() *MockOTPRepository {
	return &MockOTPRepository{
		otps: make(map[string]OTPEntry),
	}
}

// StoreOTP stores an OTP with expiration time
func (r *MockOTPRepository) StoreOTP(phone, otp string, expireAt time.Time) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.otps[phone] = OTPEntry{
		OTP:      otp,
		ExpireAt: expireAt.Unix(),
	}

	return nil
}

// VerifyOTP verifies an OTP and consumes it if valid
func (r *MockOTPRepository) VerifyOTP(phone, otp string) bool {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	entry, exists := r.otps[phone]
	if !exists {
		return false
	}

	// Check if OTP matches
	if entry.OTP != otp {
		return false
	}

	// Check if OTP has expired
	if time.Now().Unix() > entry.ExpireAt {
		// Clean up expired OTP
		delete(r.otps, phone)
		return false
	}

	// OTP is valid, consume it (remove from storage)
	delete(r.otps, phone)
	return true
}

// InvalidateOTP invalidates/deletes an OTP
func (r *MockOTPRepository) InvalidateOTP(phone string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	delete(r.otps, phone)
	return nil
}

// Test helper methods

// Clear clears all OTPs from the repository
func (r *MockOTPRepository) Clear() {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.otps = make(map[string]OTPEntry)
}

// Count returns the number of OTPs in the repository
func (r *MockOTPRepository) Count() int {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	return len(r.otps)
}

// GetOTPInfo returns OTP information without consuming it (for testing)
func (r *MockOTPRepository) GetOTPInfo(phone string) (string, time.Time, bool) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	entry, exists := r.otps[phone]
	if !exists {
		return "", time.Time{}, false
	}

	return entry.OTP, time.Unix(entry.ExpireAt, 0), true
}

// GetAll returns all OTPs (for testing purposes)
func (r *MockOTPRepository) GetAll() map[string]OTPEntry {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	result := make(map[string]OTPEntry)
	for k, v := range r.otps {
		result[k] = v
	}

	return result
}

// IsExpired checks if an OTP has expired without consuming it
func (r *MockOTPRepository) IsExpired(phone string) bool {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	entry, exists := r.otps[phone]
	if !exists {
		return true // Consider non-existent OTPs as expired
	}

	return time.Now().Unix() > entry.ExpireAt
}

// CleanupExpired removes all expired OTPs
func (r *MockOTPRepository) CleanupExpired() int {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	now := time.Now().Unix()
	count := 0

	for phone, entry := range r.otps {
		if now > entry.ExpireAt {
			delete(r.otps, phone)
			count++
		}
	}

	return count
}

// GetOTPTTL returns the remaining time until expiration for an OTP
func (r *MockOTPRepository) GetOTPTTL(phone string) (time.Duration, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	entry, exists := r.otps[phone]
	if !exists {
		return time.Duration(-2), nil // Mimic Redis behavior for non-existent keys
	}

	now := time.Now().Unix()
	if now > entry.ExpireAt {
		return time.Duration(-1), nil // Mimic Redis behavior for expired keys
	}

	remainingSeconds := entry.ExpireAt - now
	return time.Duration(remainingSeconds) * time.Second, nil
}
