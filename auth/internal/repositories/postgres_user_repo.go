package repositories

import (
	"database/sql"
	"fmt"
)

// PostgresUserRepository implements UserRepository interface for PostgreSQL
type PostgresUserRepository struct {
	db *sql.DB
}

// NewPostgresUserRepository creates a new PostgreSQL user repository
func NewPostgresUserRepository(db *sql.DB) UserRepository {
	return &PostgresUserRepository{db: db}
}

// CreateUserIfNotExists creates a new user if one doesn't exist, otherwise returns existing user
func (r *PostgresUserRepository) CreateUserIfNotExists(phone string) (*User, error) {
	// Check if user already exists
	user, err := r.GetUserByPhone(phone)
	if err != nil && err != sql.ErrNoRows {
		return nil, fmt.Errorf("error checking if user exists: %w", err)
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
	err = r.db.QueryRow(query, phone).Scan(
		&newUser.ID,
		&newUser.Phone,
		&newUser.Name,
		&newUser.CreatedAt,
		&newUser.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("error creating user: %w", err)
	}

	return newUser, nil
}

// GetUserByPhone retrieves a user by phone number
func (r *PostgresUserRepository) GetUserByPhone(phone string) (*User, error) {
	query := `
		SELECT id, phone, name, created_at, updated_at 
		FROM users 
		WHERE phone = $1
	`

	user := &User{}
	err := r.db.QueryRow(query, phone).Scan(
		&user.ID,
		&user.Phone,
		&user.Name,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, fmt.Errorf("error getting user by phone: %w", err)
	}

	return user, nil
}

// UpdateUserName updates a user's name
func (r *PostgresUserRepository) UpdateUserName(phone, name string) (*User, error) {
	query := `
		UPDATE users 
		SET name = $1, updated_at = CURRENT_TIMESTAMP 
		WHERE phone = $2
		RETURNING id, phone, name, created_at, updated_at
	`

	user := &User{}
	err := r.db.QueryRow(query, name, phone).Scan(
		&user.ID,
		&user.Phone,
		&user.Name,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, err
		}
		return nil, fmt.Errorf("error updating user name: %w", err)
	}

	return user, nil
}

// DeleteUser deletes a user by phone number
func (r *PostgresUserRepository) DeleteUser(phone string) error {
	query := `DELETE FROM users WHERE phone = $1`

	result, err := r.db.Exec(query, phone)
	if err != nil {
		return fmt.Errorf("error deleting user: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("error getting rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
}
