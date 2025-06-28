# syntax=docker/dockerfile:1
FROM golang:1.23-alpine AS builder

# Install git for private repos and ca-certificates for HTTPS
RUN apk update && apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go mod files and download dependencies first (better caching)
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -o auth-service ./cmd/auth/main.go

# Final stage - minimal Alpine image
FROM alpine:3.21

# Install wget for health checks and CA certificates
RUN apk add --no-cache wget ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# Copy the binary
COPY --from=builder /app/auth-service /auth-service

# Change ownership and make executable
RUN chown appuser:appuser /auth-service

# Switch to non-root user
USER appuser

EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["/auth-service"] 