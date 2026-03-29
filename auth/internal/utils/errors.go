package utils

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// Common error types
const (
	ErrorTypeBadRequest          = "BAD_REQUEST"
	ErrorTypeUnauthorized        = "UNAUTHORIZED"
	ErrorTypeNotFound            = "NOT_FOUND"
	ErrorTypeInternalServerError = "INTERNAL_SERVER_ERROR"
	ErrorTypeMethodNotAllowed    = "METHOD_NOT_ALLOWED"
	ErrorTypeConflict            = "CONFLICT"
)

// SendJSONError sends a standardized JSON error response
func SendJSONError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	errorType := getErrorType(statusCode)

	response := ErrorResponse{
		Error:   errorType,
		Message: message,
		Code:    statusCode,
	}

	json.NewEncoder(w).Encode(response)
}

// SendJSONResponse sends a standardized JSON success response
func SendJSONResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// DecodeJSONRequest decodes JSON request body into the provided interface
func DecodeJSONRequest(r *http.Request, v interface{}) error {
	return json.NewDecoder(r.Body).Decode(v)
}

// getErrorType maps HTTP status codes to error types
func getErrorType(statusCode int) string {
	switch statusCode {
	case http.StatusBadRequest:
		return ErrorTypeBadRequest
	case http.StatusUnauthorized:
		return ErrorTypeUnauthorized
	case http.StatusNotFound:
		return ErrorTypeNotFound
	case http.StatusMethodNotAllowed:
		return ErrorTypeMethodNotAllowed
	case http.StatusConflict:
		return ErrorTypeConflict
	case http.StatusInternalServerError:
		return ErrorTypeInternalServerError
	default:
		return "ERROR"
	}
}
