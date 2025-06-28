package models

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"auth/internal/storage"

	"github.com/redis/go-redis/v9"
)

type OTPEntry struct {
	OTP      string
	ExpireAt int64 // Unix timestamp
}

type User struct {
	Phone string
}

func StoreOTP(phone, otp string, expireAt time.Time) error {
	key := fmt.Sprintf("otp:%s", phone)
	entry := OTPEntry{OTP: otp, ExpireAt: expireAt.Unix()}
	return storage.RedisClient.Set(storage.GetContext(), key, fmt.Sprintf("%s:%d", entry.OTP, entry.ExpireAt), time.Until(expireAt)).Err()
}

func VerifyOTP(phone, otp string) bool {
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

func CreateUserIfNotExists(phone string) error {
	key := fmt.Sprintf("user:%s", phone)
	_, err := storage.RedisClient.Get(storage.GetContext(), key).Result()
	if err == redis.Nil {
		return storage.RedisClient.Set(storage.GetContext(), key, phone, 0).Err()
	}
	return nil
}
