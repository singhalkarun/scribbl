package models

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"auth/internal/config"
	"auth/internal/storage"
)

type OTPEntry struct {
	OTP      string
	ExpireAt int64 // Unix timestamp
}

type User struct {
	ID        int       `json:"id"`
	Phone     string    `json:"phone"`
	Name      *string   `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type UpdateUserRequest struct {
	Name string `json:"name"`
}

// OTP functions use Redis for temporary storage, or mock storage for testing
func StoreOTP(phone, otp string, expireAt time.Time) error {
	// For testing, if no Redis connection exists, use mock storage
	if storage.RedisClient == nil {
		entry := OTPEntry{OTP: otp, ExpireAt: expireAt.Unix()}
		mockOTPs[phone] = entry
		return nil
	}

	key := fmt.Sprintf("otp:%s", phone)
	entry := OTPEntry{OTP: otp, ExpireAt: expireAt.Unix()}
	return storage.RedisClient.Set(storage.GetContext(), key, fmt.Sprintf("%s:%d", entry.OTP, entry.ExpireAt), config.OTPExpiry).Err()
}

func VerifyOTP(phone, otp string) bool {
	// For testing, if no Redis connection exists, use mock storage
	if storage.RedisClient == nil {
		entry, exists := mockOTPs[phone]
		if !exists {
			return false
		}

		if entry.OTP != otp {
			return false
		}

		if time.Now().Unix() > entry.ExpireAt {
			return false
		}

		// Remove OTP after verification (consume it)
		delete(mockOTPs, phone)
		return true
	}

	key := fmt.Sprintf("otp:%s", phone)

	val, err := storage.RedisClient.Get(storage.GetContext(), key).Result()
	if err != nil {
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

	if storedOTP != otp {
		return false
	}

	if time.Now().Unix() > expireAt {
		return false
	}

	storage.RedisClient.Del(storage.GetContext(), key)
	return true
}

// In-memory mock storage for testing
var mockUsers = make(map[string]*User)
var mockOTPs = make(map[string]OTPEntry)

// User functions now use PostgreSQL
func CreateUserIfNotExists(phone string) (*User, error) {
	// For testing, if no database connection exists, use mock storage
	if storage.DB == nil {
		if user, exists := mockUsers[phone]; exists {
			return user, nil
		}

		newUser := &User{
			ID:        len(mockUsers) + 1,
			Phone:     phone,
			Name:      nil,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}
		mockUsers[phone] = newUser
		return newUser, nil
	}

	// Check if user already exists
	user, err := GetUserByPhone(phone)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error checking if user exists: %v", err)
	}

	// If user exists, return the existing user
	if user != nil {
		return user, nil
	}

	// Create new user
	query := `
		INSERT INTO users (phone) 
		VALUES ($1) 
		RETURNING id, phone, name, created_at, updated_at
	`

	newUser := &User{}
	err = storage.DB.QueryRow(query, phone).Scan(
		&newUser.ID,
		&newUser.Phone,
		&newUser.Name,
		&newUser.CreatedAt,
		&newUser.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("error creating user: %v", err)
	}

	return newUser, nil
}

func GetUserByPhone(phone string) (*User, error) {
	// For testing, if no database connection exists, use mock storage
	if storage.DB == nil {
		if user, exists := mockUsers[phone]; exists {
			return user, nil
		}
		return nil, sql.ErrNoRows
	}

	query := `
		SELECT id, phone, name, created_at, updated_at 
		FROM users 
		WHERE phone = $1
	`

	user := &User{}
	err := storage.DB.QueryRow(query, phone).Scan(
		&user.ID,
		&user.Phone,
		&user.Name,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (u *User) UpdateName(newName string) error {
	// For testing, if no database connection exists, update mock storage
	if storage.DB == nil {
		u.Name = &newName
		u.UpdatedAt = time.Now()
		mockUsers[u.Phone] = u
		return nil
	}

	query := `
		UPDATE users 
		SET name = $1, updated_at = CURRENT_TIMESTAMP 
		WHERE phone = $2
		RETURNING updated_at
	`

	err := storage.DB.QueryRow(query, newName, u.Phone).Scan(&u.UpdatedAt)
	if err != nil {
		return fmt.Errorf("error updating user name: %v", err)
	}

	u.Name = &newName
	return nil
}

// ClearMockUsers clears the mock user and OTP storage for testing
func ClearMockUsers() {
	mockUsers = make(map[string]*User)
	mockOTPs = make(map[string]OTPEntry)
}
