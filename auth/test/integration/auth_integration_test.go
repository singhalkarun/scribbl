// auth_integration_test.go - Integration tests for the complete authentication API
//
// These tests verify the entire authentication flow from HTTP request to response,
// testing the service as a black box without internal package dependencies.
//
// To run: go test -v ./test/integration (Redis and proper environment must be available)

package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"auth/internal/container"
	"auth/internal/handlers"

	"github.com/joho/godotenv"
)

// TestMain initializes the test environment
func TestMain(m *testing.M) {
	// Load test environment
	if err := godotenv.Load("../../sample.env"); err != nil {
		// It's okay if sample.env doesn't exist
	}

	// Set required test environment variables if not already set
	if os.Getenv("SECRET_KEY_BASE") == "" {
		os.Setenv("SECRET_KEY_BASE", "test_secret_key_for_integration_testing")
	}
	if os.Getenv("TWO_FACTOR_API_KEY") == "" {
		os.Setenv("TWO_FACTOR_API_KEY", "test_api_key")
	}
	if os.Getenv("OTP_TEMPLATE_NAME") == "" {
		os.Setenv("OTP_TEMPLATE_NAME", "test_template")
	}

	// Run tests
	code := m.Run()
	os.Exit(code)
}

// setupTestServer creates a test server with the new container architecture
func setupTestServer() *httptest.Server {
	// Create container with auto-detection (will use Redis if available, fallback to mocks)
	appContainer, err := container.CreateAutoDetectedContainer()
	if err != nil {
		panic("Failed to create test container: " + err.Error())
	}

	// Create test server with container-based handlers
	mux := http.NewServeMux()

	// Use the new SetupRoutes helper
	handlers.SetupRoutes(mux, appContainer)

	server := httptest.NewServer(mux)

	// Store container reference for cleanup
	server.Config.Handler = &testHandlerWithCleanup{
		Handler:   mux,
		Container: appContainer,
	}

	return server
}

// testHandlerWithCleanup wraps the handler and container for proper cleanup
type testHandlerWithCleanup struct {
	http.Handler
	Container container.ContainerInterface
}

func (t *testHandlerWithCleanup) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	t.Handler.ServeHTTP(w, r)
}

func clearTestData(c container.ContainerInterface) {
	// Try to clear test data if this is a test container
	if closer, ok := c.(interface{ ClearAllData() }); ok {
		closer.ClearAllData()
	}
}

// TestCompleteAuthFlow tests the complete authentication workflow
func TestCompleteAuthFlow(t *testing.T) {
	server := setupTestServer()
	defer server.Close()
	client := server.Client()

	// Clear test data
	if wrapper, ok := server.Config.Handler.(*testHandlerWithCleanup); ok {
		clearTestData(wrapper.Container)
		defer wrapper.Container.Shutdown()
	}

	phone := "+19999999999" // Use test phone number

	t.Run("request OTP", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"phone": phone})
		resp, err := client.Post(server.URL+"/auth/request-otp", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("Failed to request OTP: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200, got %d", resp.StatusCode)
		}
	})

	t.Run("verify OTP and get JWT", func(t *testing.T) {
		// Use the known test OTP for the test phone number
		testOTP := "7415" // Fixed OTP for test phone +19999999999

		// Verify with the known test OTP
		body, _ := json.Marshal(map[string]string{"phone": phone, "otp": testOTP})
		resp, err := client.Post(server.URL+"/auth/verify-otp", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("Failed to verify OTP: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200, got %d", resp.StatusCode)
		}

		var response map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response["token"] == nil {
			t.Fatalf("Expected JWT token in response")
		}
	})
}

// TestUserManagementFlow tests the user management endpoints
func TestUserManagementFlow(t *testing.T) {
	server := setupTestServer()
	defer server.Close()
	client := server.Client()

	// Clear test data
	if wrapper, ok := server.Config.Handler.(*testHandlerWithCleanup); ok {
		clearTestData(wrapper.Container)
		defer wrapper.Container.Shutdown()
	}

	phone := "+19999999999" // Use test phone number
	testOTP := "7415"       // Fixed OTP for test phone
	var tokenString string  // JWT token for authenticated requests

	// First, go through the complete auth flow to create the user and get a real JWT token
	t.Run("setup user through auth flow", func(t *testing.T) {
		// Request OTP
		body, _ := json.Marshal(map[string]string{"phone": phone})
		resp, err := client.Post(server.URL+"/auth/request-otp", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("Failed to request OTP: %v", err)
		}
		resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200 for OTP request, got %d", resp.StatusCode)
		}

		// Verify OTP to create user and get token
		body, _ = json.Marshal(map[string]string{"phone": phone, "otp": testOTP})
		resp, err = client.Post(server.URL+"/auth/verify-otp", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("Failed to verify OTP: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200 for OTP verification, got %d", resp.StatusCode)
		}

		var response map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response["token"] == nil {
			t.Fatalf("Expected JWT token in response")
		}

		// Store the token for the next tests
		tokenString = response["token"].(string)
	})

	t.Run("get user profile", func(t *testing.T) {
		req, _ := http.NewRequest("GET", server.URL+"/auth/user", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)

		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Failed to get user: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200, got %d", resp.StatusCode)
		}
	})

	t.Run("update user name", func(t *testing.T) {
		updateData := map[string]string{"name": "John Doe"}
		jsonData, _ := json.Marshal(updateData)

		req, _ := http.NewRequest("PUT", server.URL+"/auth/user/update", bytes.NewReader(jsonData))
		req.Header.Set("Authorization", "Bearer "+tokenString)
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Failed to update user: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected 200, got %d", resp.StatusCode)
		}
	})
}
