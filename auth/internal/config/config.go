package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"time"
)

// Database configuration
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// Connection pool configuration
type PoolConfig struct {
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// Application constants
const (
	// User validation
	MaxNameLength = 100
	MinNameLength = 1

	// JWT
	DefaultJWTExpiry = 24 * time.Hour

	// OTP
	OTPExpiry = 5 * time.Minute
	OTPLength = 4

	// Default values
	DefaultPort         = "8080"
	DefaultPostgresPort = "5432"
	DefaultPostgresHost = "localhost"
	DefaultPostgresUser = "postgres"
	DefaultPostgresDB   = "auth_db"
	DefaultSSLMode      = "disable"
)

var (
	// Cached configuration
	jwtSecret string
)

// GetDatabaseConfig returns database configuration from environment
func GetDatabaseConfig() DatabaseConfig {
	return DatabaseConfig{
		Host:     getEnvOrDefault("POSTGRES_HOST", DefaultPostgresHost),
		Port:     getEnvOrDefault("POSTGRES_PORT", DefaultPostgresPort),
		User:     getEnvOrDefault("POSTGRES_USER", DefaultPostgresUser),
		Password: getRequiredEnv("POSTGRES_PASSWORD"),
		DBName:   getEnvOrDefault("POSTGRES_DB", DefaultPostgresDB),
		SSLMode:  getEnvOrDefault("POSTGRES_SSLMODE", DefaultSSLMode),
	}
}

// GetPoolConfig returns connection pool configuration
func GetPoolConfig() PoolConfig {
	return PoolConfig{
		MaxOpenConns:    getEnvAsIntOrDefault("POSTGRES_MAX_OPEN_CONNS", 25),
		MaxIdleConns:    getEnvAsIntOrDefault("POSTGRES_MAX_IDLE_CONNS", 5),
		ConnMaxLifetime: time.Hour,
	}
}

// GetJWTSecret returns cached JWT secret
func GetJWTSecret() string {
	if jwtSecret == "" {
		jwtSecret = getRequiredEnv("SECRET_KEY_BASE")
	}
	return jwtSecret
}

// GetJWTSecretWithError returns cached JWT secret or error (for testing)
func GetJWTSecretWithError() (string, error) {
	if jwtSecret == "" {
		secret, err := getRequiredEnvWithError("SECRET_KEY_BASE")
		if err != nil {
			return "", err
		}
		jwtSecret = secret
	}
	return jwtSecret, nil
}

// ClearJWTSecretCache clears the cached JWT secret (for testing)
func ClearJWTSecretCache() {
	jwtSecret = ""
}

// Helper functions
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getRequiredEnv(key string) string {
	value := os.Getenv(key)
	if value == "" {
		log.Fatalf("Required environment variable %s not set", key)
	}
	return value
}

// getRequiredEnvWithError returns the environment variable or an error (for testing)
func getRequiredEnvWithError(key string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		return "", fmt.Errorf("required environment variable %s not set", key)
	}
	return value, nil
}

func getEnvAsIntOrDefault(key string, defaultValue int) int {
	valueStr := os.Getenv(key)
	if valueStr == "" {
		return defaultValue
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		log.Printf("Invalid integer value for %s: %s, using default: %d", key, valueStr, defaultValue)
		return defaultValue
	}

	return value
}
