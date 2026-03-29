package repositories

import (
	"database/sql"
	"sync"
	"time"
)

// MockUserRepository implements UserRepository interface for testing
type MockUserRepository struct {
	users  map[string]*User
	mutex  sync.RWMutex
	nextID int
}

// NewMockUserRepository creates a new mock user repository
func NewMockUserRepository() *MockUserRepository {
	return &MockUserRepository{
		users:  make(map[string]*User),
		nextID: 1,
	}
}

// CreateUserIfNotExists creates a new user if one doesn't exist, otherwise returns existing user
func (r *MockUserRepository) CreateUserIfNotExists(phone string) (*User, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if user, exists := r.users[phone]; exists {
		return user, nil
	}

	user := &User{
		ID:        int64(r.nextID),
		Phone:     phone,
		Name:      nil,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	r.users[phone] = user
	r.nextID++

	return user, nil
}

// GetUserByPhone retrieves a user by phone number
func (r *MockUserRepository) GetUserByPhone(phone string) (*User, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	if user, exists := r.users[phone]; exists {
		return user, nil
	}

	return nil, sql.ErrNoRows
}

// UpdateUserName updates a user's name
func (r *MockUserRepository) UpdateUserName(phone, name string) (*User, error) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	user, exists := r.users[phone]
	if !exists {
		return nil, sql.ErrNoRows
	}

	user.Name = &name
	user.UpdatedAt = time.Now()

	return user, nil
}

// DeleteUser deletes a user by phone number
func (r *MockUserRepository) DeleteUser(phone string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if _, exists := r.users[phone]; !exists {
		return sql.ErrNoRows
	}

	delete(r.users, phone)
	return nil
}

// Test helper methods

// Clear clears all users from the repository
func (r *MockUserRepository) Clear() {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.users = make(map[string]*User)
	r.nextID = 1
}

// Count returns the number of users in the repository
func (r *MockUserRepository) Count() int {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	return len(r.users)
}

// GetAll returns all users (for testing purposes)
func (r *MockUserRepository) GetAll() map[string]*User {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	result := make(map[string]*User)
	for k, v := range r.users {
		result[k] = v
	}

	return result
}

// SetNextID sets the next ID to be used (for testing purposes)
func (r *MockUserRepository) SetNextID(id int) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	r.nextID = id
}
