package services

import (
	"fmt"
	"time"

	"auth/internal/config"
	"auth/internal/repositories"
	"auth/internal/utils"

	"github.com/golang-jwt/jwt/v4"
)

// AuthServiceImpl implements AuthService interface
type AuthServiceImpl struct {
	userRepo repositories.UserRepository
	otpRepo  repositories.OTPRepository
}

// NewAuthService creates a new authentication service
func NewAuthService(userRepo repositories.UserRepository, otpRepo repositories.OTPRepository) AuthService {
	return &AuthServiceImpl{
		userRepo: userRepo,
		otpRepo:  otpRepo,
	}
}

// RequestOTP generates and sends an OTP for the given phone number
func (s *AuthServiceImpl) RequestOTP(phone string) error {
	// Validate phone number format
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return fmt.Errorf("invalid phone format: %w", err)
	}

	// Generate OTP
	otp := utils.GenerateOTPForPhone(phone)

	// Send OTP via SMS first (fail fast if SMS fails)
	if err := utils.SendOTPWith2Factor(phone, otp); err != nil {
		return fmt.Errorf("failed to send OTP: %w", err)
	}

	// Store OTP with expiration
	expireAt := time.Now().Add(config.OTPExpiry)
	if err := s.otpRepo.StoreOTP(phone, otp, expireAt); err != nil {
		return fmt.Errorf("failed to store OTP: %w", err)
	}

	return nil
}

// VerifyOTP verifies an OTP and returns user and JWT token on success
func (s *AuthServiceImpl) VerifyOTP(phone, otp string) (*repositories.User, string, error) {
	// Validate phone number format
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return nil, "", fmt.Errorf("invalid phone format: %w", err)
	}

	// Validate OTP format
	if err := utils.ValidateOTPFormat(otp); err != nil {
		return nil, "", fmt.Errorf("invalid OTP format: %w", err)
	}

	// Verify OTP (this consumes the OTP if valid)
	if !s.otpRepo.VerifyOTP(phone, otp) {
		return nil, "", fmt.Errorf("invalid or expired OTP")
	}

	// Create or get user
	user, err := s.userRepo.CreateUserIfNotExists(phone)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create/get user: %w", err)
	}

	// Generate JWT token
	token, err := s.generateJWTToken(phone)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate authentication token: %w", err)
	}

	return user, token, nil
}

// generateJWTToken creates a JWT token for the given phone number
func (s *AuthServiceImpl) generateJWTToken(phone string) (string, error) {
	jwtSecret, err := config.GetJWTSecretWithError()
	if err != nil {
		return "", fmt.Errorf("authentication service configuration error: %w", err)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"phone": phone,
		"exp":   time.Now().Add(config.DefaultJWTExpiry).Unix(),
	})

	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT token: %w", err)
	}

	return tokenString, nil
}

// Additional helper methods for extended functionality

// InvalidateOTP invalidates an OTP for a given phone number
func (s *AuthServiceImpl) InvalidateOTP(phone string) error {
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return fmt.Errorf("invalid phone format: %w", err)
	}

	return s.otpRepo.InvalidateOTP(phone)
}

// IsOTPValid checks if an OTP is valid without consuming it (for testing)
func (s *AuthServiceImpl) IsOTPValid(phone, otp string) (bool, error) {
	if err := utils.ValidatePhoneFormat(phone); err != nil {
		return false, fmt.Errorf("invalid phone format: %w", err)
	}

	if err := utils.ValidateOTPFormat(otp); err != nil {
		return false, fmt.Errorf("invalid OTP format: %w", err)
	}

	// Use the interface method GetOTPInfo which is now implemented by all repositories
	storedOTP, expireAt, exists := s.otpRepo.GetOTPInfo(phone)
	if !exists {
		return false, nil
	}

	return storedOTP == otp && time.Now().Before(expireAt), nil
}
