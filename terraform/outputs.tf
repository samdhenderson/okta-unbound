output "group_ids" {
  description = "IDs of created test groups"
  value = {
    engineering       = okta_group.engineering.id
    sales            = okta_group.sales.id
    product          = okta_group.product.id
    marketing        = okta_group.marketing.id
    inactive_cleanup = okta_group.inactive_cleanup.id
    large_group      = okta_group.large_group.id
  }
}

output "group_urls" {
  description = "Direct URLs to test groups in Okta admin console"
  value = {
    engineering       = "https://${var.okta_org_name}.${var.okta_base_url}/admin/group/${okta_group.engineering.id}"
    sales            = "https://${var.okta_org_name}.${var.okta_base_url}/admin/group/${okta_group.sales.id}"
    product          = "https://${var.okta_org_name}.${var.okta_base_url}/admin/group/${okta_group.product.id}"
    marketing        = "https://${var.okta_org_name}.${var.okta_base_url}/admin/group/${okta_group.marketing.id}"
    inactive_cleanup = "https://${var.okta_org_name}.${var.okta_base_url}/admin/group/${okta_group.inactive_cleanup.id}"
    large_group      = "https://${var.okta_org_name}.${var.okta_base_url}/admin/group/${okta_group.large_group.id}"
  }
}

output "user_summary" {
  description = "Summary of created test users by status"
  value = {
    active_users         = length(okta_user.active_users)
    staged_users         = length(okta_user.staged_users)
    provisioned_users    = length(okta_user.provisioned_users)
    deprovisioned_users  = length(okta_user.deprovisioned_users)
    suspended_users      = length(okta_user.suspended_users)
    admin_user          = 1
    total_users         = length(okta_user.active_users) + length(okta_user.staged_users) + length(okta_user.provisioned_users) + length(okta_user.deprovisioned_users) + length(okta_user.suspended_users) + 1
  }
}

output "group_rules" {
  description = "Created group rules for testing rule inspector"
  value = {
    engineering_rule = {
      id   = okta_group_rule.engineering_auto_assign.id
      name = okta_group_rule.engineering_auto_assign.name
    }
    product_rule = {
      id   = okta_group_rule.product_auto_assign.id
      name = okta_group_rule.product_auto_assign.name
    }
  }
}

output "testing_scenarios" {
  description = "Testing scenarios and which groups to use"
  value = {
    cleanup_deprovisioned = "Use 'Inactive Users Cleanup Test' group - contains 8 deprovisioned users"
    cleanup_all_inactive  = "Use 'Inactive Users Cleanup Test' group - contains deprovisioned, suspended, and staged users"
    export_functionality  = "Use any group - all contain users with various statuses"
    pagination_testing    = "Use 'Large Test Group' - contains 35+ users for pagination"
    group_comparison      = "Compare 'Engineering Team' vs 'Product Team' - they have overlapping members"
    cross_group_search    = "Search for active.user1@example.com - member of multiple groups"
    rule_inspector        = "Two active group rules available for testing"
    security_scan         = "Use 'Inactive Users Cleanup Test' for orphaned/inactive user detection"
  }
}
