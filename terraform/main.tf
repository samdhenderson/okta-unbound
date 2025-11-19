terraform {
  required_providers {
    okta = {
      source  = "okta/okta"
      version = "~> 4.0"
    }
  }
  required_version = ">= 1.0"
}

provider "okta" {
  org_name  = var.okta_org_name
  base_url  = var.okta_base_url
  api_token = var.okta_api_token
}

# Create test groups
resource "okta_group" "engineering" {
  name        = "Engineering Team"
  description = "Engineering department test group"
}

resource "okta_group" "sales" {
  name        = "Sales Team"
  description = "Sales department test group"
}

resource "okta_group" "product" {
  name        = "Product Team"
  description = "Product department test group"
}

resource "okta_group" "marketing" {
  name        = "Marketing Team"
  description = "Marketing department test group"
}

resource "okta_group" "inactive_cleanup" {
  name        = "Inactive Users Cleanup Test"
  description = "Group for testing cleanup of inactive users"
}

resource "okta_group" "large_group" {
  name        = "Large Test Group"
  description = "Group for testing pagination with 100+ members"
}

# Create active test users
resource "okta_user" "active_users" {
  count = 15

  first_name = "Active"
  last_name  = "User${count.index + 1}"
  login      = "active.user${count.index + 1}@example.com"
  email      = "active.user${count.index + 1}@example.com"
  status     = "ACTIVE"

  password_hash {
    algorithm = "BCRYPT"
    value     = "$2a$10$example.hash.value.for.testing.purposes.only"
  }
}

# Create staged users (not yet activated)
resource "okta_user" "staged_users" {
  count = 5

  first_name = "Staged"
  last_name  = "User${count.index + 1}"
  login      = "staged.user${count.index + 1}@example.com"
  email      = "staged.user${count.index + 1}@example.com"
  status     = "STAGED"
}

# Create provisioned users (pending user action)
resource "okta_user" "provisioned_users" {
  count = 3

  first_name = "Provisioned"
  last_name  = "User${count.index + 1}"
  login      = "provisioned.user${count.index + 1}@example.com"
  email      = "provisioned.user${count.index + 1}@example.com"
  status     = "PROVISIONED"
}

# Create users that will be deprovisioned (for cleanup testing)
resource "okta_user" "deprovisioned_users" {
  count = 8

  first_name = "Deprovisioned"
  last_name  = "User${count.index + 1}"
  login      = "deprovisioned.user${count.index + 1}@example.com"
  email      = "deprovisioned.user${count.index + 1}@example.com"
  status     = "DEPROVISIONED"
}

# Create users that will be suspended
resource "okta_user" "suspended_users" {
  count = 4

  first_name = "Suspended"
  last_name  = "User${count.index + 1}"
  login      = "suspended.user${count.index + 1}@example.com"
  email      = "suspended.user${count.index + 1}@example.com"
  status     = "SUSPENDED"
}

# Create admin user for testing
resource "okta_user" "admin_user" {
  first_name = "Test"
  last_name  = "Administrator"
  login      = "admin@example.com"
  email      = "admin@example.com"
  status     = "ACTIVE"

  password_hash {
    algorithm = "BCRYPT"
    value     = "$2a$10$example.hash.value.for.testing.purposes.only"
  }
}

# Assign active users to Engineering group
resource "okta_group_memberships" "engineering_members" {
  group_id = okta_group.engineering.id
  users    = slice(okta_user.active_users[*].id, 0, 8)
}

# Assign active users to Sales group
resource "okta_group_memberships" "sales_members" {
  group_id = okta_group.sales.id
  users    = slice(okta_user.active_users[*].id, 5, 13)
}

# Assign active users to Product group (overlaps with Engineering)
resource "okta_group_memberships" "product_members" {
  group_id = okta_group.product.id
  users    = concat(
    slice(okta_user.active_users[*].id, 0, 5),
    slice(okta_user.active_users[*].id, 10, 15)
  )
}

# Assign users to Marketing group
resource "okta_group_memberships" "marketing_members" {
  group_id = okta_group.marketing.id
  users    = slice(okta_user.active_users[*].id, 3, 10)
}

# Create test group with mixed status users (for cleanup testing)
resource "okta_group_memberships" "inactive_cleanup_members" {
  group_id = okta_group.inactive_cleanup.id
  users = concat(
    slice(okta_user.active_users[*].id, 0, 3),
    okta_user.deprovisioned_users[*].id,
    okta_user.suspended_users[*].id,
    okta_user.staged_users[*].id
  )
}

# Create large group for pagination testing (100+ members)
resource "okta_group_memberships" "large_group_members" {
  group_id = okta_group.large_group.id
  users = concat(
    okta_user.active_users[*].id,
    okta_user.staged_users[*].id,
    okta_user.provisioned_users[*].id,
    okta_user.deprovisioned_users[*].id,
    okta_user.suspended_users[*].id,
    [okta_user.admin_user.id]
  )
}

# Create a group rule for automatic assignment
resource "okta_group_rule" "engineering_auto_assign" {
  name   = "Auto-assign Engineering by Email Domain"
  status = "ACTIVE"
  group_assignments = [
    okta_group.engineering.id
  ]
  expression_type  = "urn:okta:expression:1.0"
  expression_value = "user.email.endsWith(\"@engineering.example.com\")"
}

# Create another group rule for testing rule inspector
resource "okta_group_rule" "product_auto_assign" {
  name   = "Auto-assign Product Team"
  status = "ACTIVE"
  group_assignments = [
    okta_group.product.id
  ]
  expression_type  = "urn:okta:expression:1.0"
  expression_value = "user.department == \"Product\""
}

# Create a custom user schema attribute for testing
resource "okta_user_schema_property" "department" {
  index       = "department"
  title       = "Department"
  type        = "string"
  description = "User's department for group rule testing"
  master      = "PROFILE_MASTER"
  scope       = "NONE"
}
