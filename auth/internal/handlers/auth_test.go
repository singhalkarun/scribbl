// auth_test.go - Integration tests for the OTP authentication flow.
//
// This test suite covers the core OTP authentication flow:
// - Requesting an OTP (mocked SMS delivery)
// - Storing and verifying OTPs in Redis
// - Handling valid, invalid, expired, and missing OTPs
// - Rate limiting, CORS, replay attack, malformed JSON, and JWT claims
//
// The SendOTPWith2Factor function is mocked to avoid real SMS sending.
// Redis is flushed before each test for isolation.
//
// Scenarios covered:
// - Valid OTP: Should authenticate and return a JWT
// - Invalid OTP: Should return 401 Unauthorized
// - Expired OTP: Should return 401 Unauthorized
// - Missing fields: Should return 400 Bad Request
// - Rate limiting: Should return 429 after 5 requests per minute
// - CORS preflight: Should return 200 and CORS headers
// - Multiple users: OTPs for different phones are isolated
// - Replay attack: OTP cannot be used twice
// - Malformed JSON: Should return 400 Bad Request
// - Empty phone: Should return 400 Bad Request
// - JWT claims: JWT contains correct phone and expiry
//
// To run: go test -v ./internal/handlers (Redis must be running)

package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"testing"
	"time"

	"auth/internal/middleware"
	"auth/internal/models"
	"auth/internal/storage"
	"auth/internal/utils"

	"github.com/golang-jwt/jwt/v4"
)

// mockSendOTPWith2Factor replaces the real SMS sending with a no-op for tests.
func mockSendOTPWith2Factor(phone, otp string) error {
	return nil // do nothing
}

// flushRedis clears all keys in Redis to isolate each test run.
func flushRedis() {
	storage.RedisClient.FlushDB(storage.GetContext())
}

func setupTestServer() *httptest.Server {
	mux := http.NewServeMux()
	mux.Handle("/auth/request-otp", middleware.CorsMiddleware(middleware.RateLimitMiddleware(http.HandlerFunc(RequestOTPHandler))))
	mux.Handle("/auth/verify-otp", middleware.CorsMiddleware(http.HandlerFunc(VerifyOTPHandler)))
	return httptest.NewServer(mux)
}

func TestAuthFlow(t *testing.T) {
	os.Setenv("SECRET_KEY_BASE", "testsecret")
	storage.InitRedis()
	origSend := utils.SendOTPWith2Factor
	utils.SendOTPWith2Factor = mockSendOTPWith2Factor
	defer func() { utils.SendOTPWith2Factor = origSend }()
	flushRedis()

	phone := "+919998887777"
	otp := "1234"

	// 1. Simulate requesting an OTP (would send SMS in production)
	body, _ := json.Marshal(map[string]string{"phone": phone})
	req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	RequestOTPHandler(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// 2. Store OTP manually for test (since we control the value)
	expireAt := time.Now().Add(5 * time.Minute)
	if err := models.StoreOTP(phone, otp, expireAt); err != nil {
		t.Fatalf("failed to store OTP: %v", err)
	}

	t.Run("valid OTP", func(t *testing.T) {
		verifyBody, _ := json.Marshal(map[string]string{"phone": phone, "otp": otp})
		verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
		verifyRec := httptest.NewRecorder()
		VerifyOTPHandler(verifyRec, verifyReq)
		if verifyRec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", verifyRec.Code)
		}
		var resp struct {
			Message string `json:"message"`
			Token   string `json:"token"`
		}
		if err := json.NewDecoder(verifyRec.Body).Decode(&resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.Token == "" {
			t.Fatalf("expected JWT token in response")
		}
		parsed, err := jwt.Parse(resp.Token, func(token *jwt.Token) (interface{}, error) {
			return []byte("testsecret"), nil
		})
		if err != nil || !parsed.Valid {
			t.Fatalf("invalid JWT token: %v", err)
		}
		claims, ok := parsed.Claims.(jwt.MapClaims)
		if !ok || claims["phone"] != phone {
			t.Fatalf("JWT claims missing or incorrect")
		}
		if exp, ok := claims["exp"].(float64); !ok || exp < float64(time.Now().Unix()) {
			t.Fatalf("JWT exp claim not set correctly")
		}
	})

	t.Run("invalid OTP", func(t *testing.T) {
		verifyBody, _ := json.Marshal(map[string]string{"phone": phone, "otp": "0000"})
		verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
		verifyRec := httptest.NewRecorder()
		VerifyOTPHandler(verifyRec, verifyReq)
		if verifyRec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", verifyRec.Code)
		}
	})

	t.Run("expired OTP", func(t *testing.T) {
		expiredAt := time.Now().Add(-1 * time.Minute)
		models.StoreOTP(phone, otp, expiredAt)
		verifyBody, _ := json.Marshal(map[string]string{"phone": phone, "otp": otp})
		verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
		verifyRec := httptest.NewRecorder()
		VerifyOTPHandler(verifyRec, verifyReq)
		if verifyRec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", verifyRec.Code)
		}
	})

	t.Run("missing fields", func(t *testing.T) {
		verifyBody, _ := json.Marshal(map[string]string{"phone": phone})
		verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
		verifyRec := httptest.NewRecorder()
		VerifyOTPHandler(verifyRec, verifyReq)
		if verifyRec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", verifyRec.Code)
		}
	})

	t.Run("multiple users", func(t *testing.T) {
		flushRedis()
		phoneA := "+911112223333"
		phoneB := "+914445556666"
		otpA := "6543"
		otpB := "7890"
		expireAt := time.Now().Add(5 * time.Minute)
		models.StoreOTP(phoneA, otpA, expireAt)
		models.StoreOTP(phoneB, otpB, expireAt)
		verifyBodyA, _ := json.Marshal(map[string]string{"phone": phoneA, "otp": otpA})
		verifyReqA := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBodyA))
		verifyRecA := httptest.NewRecorder()
		VerifyOTPHandler(verifyRecA, verifyReqA)
		if verifyRecA.Code != http.StatusOK {
			t.Fatalf("expected 200 for user A, got %d", verifyRecA.Code)
		}
		verifyBodyB, _ := json.Marshal(map[string]string{"phone": phoneB, "otp": otpB})
		verifyReqB := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBodyB))
		verifyRecB := httptest.NewRecorder()
		VerifyOTPHandler(verifyRecB, verifyReqB)
		if verifyRecB.Code != http.StatusOK {
			t.Fatalf("expected 200 for user B, got %d", verifyRecB.Code)
		}
	})

	t.Run("replay attack", func(t *testing.T) {
		flushRedis()
		phoneR := "+912223334444"
		otpR := "3216"
		expireAt := time.Now().Add(5 * time.Minute)
		models.StoreOTP(phoneR, otpR, expireAt)
		verifyBody, _ := json.Marshal(map[string]string{"phone": phoneR, "otp": otpR})
		verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
		verifyRec := httptest.NewRecorder()
		VerifyOTPHandler(verifyRec, verifyReq)
		if verifyRec.Code != http.StatusOK {
			t.Fatalf("expected 200 on first use, got %d", verifyRec.Code)
		}
		// Try to use the same OTP again
		verifyReq2 := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
		verifyRec2 := httptest.NewRecorder()
		VerifyOTPHandler(verifyRec2, verifyReq2)
		if verifyRec2.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 on replay, got %d", verifyRec2.Code)
		}
	})

	t.Run("malformed JSON", func(t *testing.T) {
		verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader([]byte("not-json")))
		verifyRec := httptest.NewRecorder()
		VerifyOTPHandler(verifyRec, verifyReq)
		if verifyRec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for malformed JSON, got %d", verifyRec.Code)
		}
	})

	t.Run("empty phone", func(t *testing.T) {
		verifyBody, _ := json.Marshal(map[string]string{"phone": "", "otp": otp})
		verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
		verifyRec := httptest.NewRecorder()
		VerifyOTPHandler(verifyRec, verifyReq)
		if verifyRec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for empty phone, got %d", verifyRec.Code)
		}
	})
}

func TestRateLimiting(t *testing.T) {
	flushRedis()
	origSend := utils.SendOTPWith2Factor
	utils.SendOTPWith2Factor = mockSendOTPWith2Factor
	defer func() { utils.SendOTPWith2Factor = origSend }()
	server := setupTestServer()
	defer server.Close()
	client := server.Client()
	phone := "+919990001111" // E.164 format
	body, _ := json.Marshal(map[string]string{"phone": phone})
	url := server.URL + "/auth/request-otp"
	for i := 0; i < 5; i++ {
		resp, err := client.Post(url, "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("http post error: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d on attempt %d", resp.StatusCode, i+1)
		}
		resp.Body.Close()
	}
	// 6th request should be rate limited
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("http post error: %v", err)
	}
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d on rate limit", resp.StatusCode)
	}
	resp.Body.Close()
}

func TestCORSPreflight(t *testing.T) {
	server := setupTestServer()
	defer server.Close()
	client := server.Client()
	url := server.URL + "/auth/request-otp"
	req, _ := http.NewRequest("OPTIONS", url, nil)
	req.Header.Set("Origin", "http://localhost:3000") // Set valid origin
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("http options error: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for OPTIONS, got %d", resp.StatusCode)
	}
	if resp.Header.Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Fatalf("expected CORS origin http://localhost:3000, got %s", resp.Header.Get("Access-Control-Allow-Origin"))
	}
	resp.Body.Close()
}

// TestPhoneFormatValidation tests E.164 phone format validation
func TestPhoneFormatValidation(t *testing.T) {
	os.Setenv("SECRET_KEY_BASE", "testsecret")
	storage.InitRedis()
	origSend := utils.SendOTPWith2Factor
	utils.SendOTPWith2Factor = mockSendOTPWith2Factor
	defer func() { utils.SendOTPWith2Factor = origSend }()
	flushRedis()

	testCases := []struct {
		name         string
		phone        string
		expectedCode int
		description  string
	}{
		{
			name:         "valid E.164 format",
			phone:        "+919876543210",
			expectedCode: http.StatusOK,
			description:  "should accept valid E.164 format",
		},
		{
			name:         "missing plus sign",
			phone:        "919876543210",
			expectedCode: http.StatusBadRequest,
			description:  "should reject phone without + prefix",
		},
		{
			name:         "starts with zero",
			phone:        "+0919876543210",
			expectedCode: http.StatusBadRequest,
			description:  "should reject phone starting with 0 after +",
		},
		{
			name:         "too short",
			phone:        "+91",
			expectedCode: http.StatusBadRequest,
			description:  "should reject phone that's too short",
		},
		{
			name:         "too long",
			phone:        "+919876543210123456",
			expectedCode: http.StatusBadRequest,
			description:  "should reject phone that's too long",
		},
		{
			name:         "contains letters",
			phone:        "+91987654321a",
			expectedCode: http.StatusBadRequest,
			description:  "should reject phone with letters",
		},
		{
			name:         "contains spaces",
			phone:        "+91 9876543210",
			expectedCode: http.StatusBadRequest,
			description:  "should reject phone with spaces",
		},
		{
			name:         "contains dashes",
			phone:        "+91-9876543210",
			expectedCode: http.StatusBadRequest,
			description:  "should reject phone with dashes",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Test request-otp endpoint
			body, _ := json.Marshal(map[string]string{"phone": tc.phone})
			req := httptest.NewRequest("POST", "/auth/request-otp", bytes.NewReader(body))
			rec := httptest.NewRecorder()
			RequestOTPHandler(rec, req)
			
			if rec.Code != tc.expectedCode {
				t.Errorf("request-otp: expected %d, got %d for phone %s (%s)", 
					tc.expectedCode, rec.Code, tc.phone, tc.description)
			}

			// Test verify-otp endpoint
			verifyBody, _ := json.Marshal(map[string]string{"phone": tc.phone, "otp": "1234"})
			verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
			verifyRec := httptest.NewRecorder()
			VerifyOTPHandler(verifyRec, verifyReq)
			
			if rec.Code != tc.expectedCode {
				t.Errorf("verify-otp: expected %d, got %d for phone %s (%s)", 
					tc.expectedCode, verifyRec.Code, tc.phone, tc.description)
			}
		})
	}
}

// TestOTPFormatValidation tests that only 4-digit OTPs are accepted
func TestOTPFormatValidation(t *testing.T) {
	os.Setenv("SECRET_KEY_BASE", "testsecret")
	storage.InitRedis()
	origSend := utils.SendOTPWith2Factor
	utils.SendOTPWith2Factor = mockSendOTPWith2Factor
	defer func() { utils.SendOTPWith2Factor = origSend }()
	flushRedis()

	phone := "+919876543210"
	
	testCases := []struct {
		name         string
		otp          string
		expectedCode int
		description  string
	}{
		{
			name:         "valid 4-digit OTP",
			otp:          "1234",
			expectedCode: http.StatusUnauthorized, // 401 because OTP doesn't exist in Redis
			description:  "should accept valid 4-digit OTP format",
		},
		{
			name:         "3-digit OTP",
			otp:          "123",
			expectedCode: http.StatusBadRequest,
			description:  "should reject 3-digit OTP",
		},
		{
			name:         "5-digit OTP",
			otp:          "12345",
			expectedCode: http.StatusBadRequest,
			description:  "should reject 5-digit OTP",
		},
		{
			name:         "6-digit OTP (legacy)",
			otp:          "123456",
			expectedCode: http.StatusBadRequest,
			description:  "should reject 6-digit OTP",
		},
		{
			name:         "OTP with letters",
			otp:          "12a4",
			expectedCode: http.StatusBadRequest,
			description:  "should reject OTP with letters",
		},
		{
			name:         "OTP with special characters",
			otp:          "12@4",
			expectedCode: http.StatusBadRequest,
			description:  "should reject OTP with special characters",
		},
		{
			name:         "empty OTP",
			otp:          "",
			expectedCode: http.StatusBadRequest,
			description:  "should reject empty OTP",
		},
		{
			name:         "OTP with spaces",
			otp:          "1 23",
			expectedCode: http.StatusBadRequest,
			description:  "should reject OTP with spaces",
		},
		{
			name:         "OTP with leading zeros",
			otp:          "0123",
			expectedCode: http.StatusUnauthorized, // 401 because OTP doesn't exist in Redis
			description:  "should accept OTP with leading zeros",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			verifyBody, _ := json.Marshal(map[string]string{"phone": phone, "otp": tc.otp})
			verifyReq := httptest.NewRequest("POST", "/auth/verify-otp", bytes.NewReader(verifyBody))
			verifyRec := httptest.NewRecorder()
			VerifyOTPHandler(verifyRec, verifyReq)
			
			if verifyRec.Code != tc.expectedCode {
				t.Errorf("expected %d, got %d for OTP %s (%s)", 
					tc.expectedCode, verifyRec.Code, tc.otp, tc.description)
			}
		})
	}
}

// TestGeneratedOTPFormat tests that the generated OTP is always 4 digits
func TestGeneratedOTPFormat(t *testing.T) {
	for i := 0; i < 100; i++ {
		otp := utils.GenerateOTP()
		if len(otp) != 4 {
			t.Errorf("Generated OTP has wrong length: expected 4, got %d (OTP: %s)", len(otp), otp)
		}
		// Check if it's all digits
		matched, _ := regexp.MatchString(`^\d{4}$`, otp)
		if !matched {
			t.Errorf("Generated OTP is not 4 digits: %s", otp)
		}
	}
}

// TestSpecialPhoneOTPFormat tests that the special test phone returns 4-digit OTP
func TestSpecialPhoneOTPFormat(t *testing.T) {
	testPhone := "+19999999999"
	otp := utils.GenerateOTPForPhone(testPhone)
	if otp != "7415" {
		t.Errorf("Expected hardcoded OTP '7415' for test phone, got %s", otp)
	}
	if len(otp) != 4 {
		t.Errorf("Test phone OTP has wrong length: expected 4, got %d", len(otp))
	}
}
