# Okta Unbound - Terraform Test Environment

This Terraform configuration creates a complete Okta test environment for developing and testing the Okta Unbound Chrome extension.

## What This Creates

### Test Groups (6 total)
1. **Engineering Team** - 8 active users
2. **Sales Team** - 8 active users
3. **Product Team** - 10 active users (overlaps with Engineering)
4. **Marketing Team** - 7 active users
5. **Inactive Users Cleanup Test** - Mixed status users (active, deprovisioned, suspended, staged)
6. **Large Test Group** - 35+ users for pagination testing

### Test Users (36 total)
- **15 Active Users** - Distributed across multiple groups
- **5 Staged Users** - Not yet activated
- **3 Provisioned Users** - Pending user action
- **8 Deprovisioned Users** - For cleanup testing
- **4 Suspended Users** - For cleanup testing
- **1 Admin User** - For testing admin operations

### Group Rules (2 total)
- **Auto-assign Engineering** - Based on email domain
- **Auto-assign Product Team** - Based on department attribute

### Custom Schema
- **Department attribute** - For testing attribute-based group rules

## Prerequisites

1. **Okta Organization**
   - You need an Okta organization (developer account is free)
   - Sign up at https://developer.okta.com/signup/

2. **Okta API Token**
   - Log into your Okta admin console
   - Navigate to: Security > API > Tokens
   - Click "Create Token"
   - Name it "Terraform" and save the token securely
   - **Important**: Save the token immediately - you can't view it again!

3. **Terraform**
   - Install Terraform: https://www.terraform.io/downloads
   - Version 1.0 or higher required

## Setup Instructions

### 1. Configure Variables

Copy the example variables file:
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your Okta details:
```hcl
okta_org_name  = "dev-123456"           # Your org from https://dev-123456.okta.com
okta_base_url  = "okta.com"             # Or oktapreview.com, okta-emea.com
okta_api_token = "00abc...your-token"   # API token from Okta
```

**Security Note**: `terraform.tfvars` is git-ignored to prevent accidentally committing your API token.

### 2. Initialize Terraform

```bash
terraform init
```

This downloads the Okta provider plugin.

### 3. Preview Changes

```bash
terraform plan
```

Review the resources that will be created (should show ~36 users, 6 groups, 2 rules, etc.)

### 4. Create Resources

```bash
terraform apply
```

Type `yes` when prompted. This takes 2-5 minutes to create all resources.

### 5. View Outputs

After successful creation, Terraform displays:
- Group IDs and direct URLs
- User counts by status
- Testing scenario recommendations

You can view outputs anytime:
```bash
terraform output
```

Get a specific output:
```bash
terraform output group_urls
```

## Testing Scenarios

### 1. Test Cleanup of Deprovisioned Users
```
Group: "Inactive Users Cleanup Test"
Contains: 8 deprovisioned users + 3 active users
Test: Remove deprovisioned users feature
Expected: 8 users removed, 3 remain
```

### 2. Test Smart Cleanup (All Inactive)
```
Group: "Inactive Users Cleanup Test"
Contains: Deprovisioned, suspended, and staged users
Test: Smart cleanup automation
Expected: All inactive users removed, only active users remain
```

### 3. Test Export Functionality
```
Group: Any group
Test: Export to CSV/JSON with status filtering
Verify: Correct user data, status filtering works
```

### 4. Test Pagination
```
Group: "Large Test Group"
Contains: 35+ users across all statuses
Test: Large group handling and pagination
Verify: All users loaded across multiple pages
```

### 5. Test Group Comparison
```
Groups: "Engineering Team" vs "Product Team"
Contains: Overlapping members
Test: Group comparison and Venn diagram
Verify: Correctly identifies shared and unique users
```

### 6. Test Cross-Group User Search
```
Search: active.user1@example.com
Expected: Found in multiple groups
Test: Remove user from all groups
```

### 7. Test Rule Inspector
```
Rules: 2 active group rules
Test: Analyze rules, detect conflicts
Verify: Rules displayed correctly with expressions
```

### 8. Test Security Scan
```
Group: "Inactive Users Cleanup Test"
Test: Security posture analysis
Expected: Detects orphaned/inactive accounts
```

## Accessing Groups in Okta

After `terraform apply`, use the group URLs from the output:

```bash
terraform output group_urls
```

Example output:
```
{
  "engineering" = "https://dev-123456.okta.com/admin/group/00g..."
  "sales" = "https://dev-123456.okta.com/admin/group/00g..."
  ...
}
```

Click any URL to open the group directly in Okta admin console, then test the extension!

## Managing the Environment

### Update Resources
After modifying `.tf` files:
```bash
terraform plan
terraform apply
```

### Destroy All Resources
**Warning**: This deletes all test users and groups!
```bash
terraform destroy
```

Type `yes` to confirm. Useful for cleaning up when done testing.

### View Current State
```bash
terraform show
```

### List All Resources
```bash
terraform state list
```

## Troubleshooting

### Authentication Errors
```
Error: Okta API Error: 401 Unauthorized
```
**Fix**: Check your API token in `terraform.tfvars` - it may have expired.

### Permission Errors
```
Error: Okta API Error: 403 Forbidden
```
**Fix**: Your API token needs admin permissions. Create a new token with full admin scope.

### Resource Already Exists
```
Error: User with email already exists
```
**Fix**: Run `terraform destroy` first to clean up existing test resources.

### Provider Download Issues
```
Error downloading provider
```
**Fix**: Check internet connection and try `terraform init -upgrade`

## Cost Considerations

- **Developer Account**: Free (up to 1,000 monthly active users)
- **Terraform**: Free and open source
- **This Config**: Creates 36 users (well under free tier limits)

## Security Best Practices

1. **Never commit `terraform.tfvars`** - Already in `.gitignore`
2. **Rotate API tokens regularly** - Create new token, update tfvars, destroy old token
3. **Use separate Okta org for testing** - Don't test in production!
4. **Limit API token scope** - Use minimum permissions needed
5. **Delete test environment when done** - Run `terraform destroy`

## File Structure

```
terraform/
├── main.tf                    # Main resource definitions
├── variables.tf               # Input variable declarations
├── outputs.tf                 # Output value definitions
├── terraform.tfvars.example   # Example configuration
├── terraform.tfvars          # Your actual config (git-ignored)
└── README.md                 # This file
```

## Customization

### Add More Users
Edit `main.tf` and increase the `count` parameter:
```hcl
resource "okta_user" "active_users" {
  count = 50  # Change from 15 to 50
  ...
}
```

### Add More Groups
Add new group resources:
```hcl
resource "okta_group" "hr_team" {
  name        = "HR Team"
  description = "Human Resources test group"
}
```

### Change User Statuses
Modify the `status` parameter in user resources:
```hcl
status = "ACTIVE"  # Options: STAGED, PROVISIONED, ACTIVE, RECOVERY,
                    #          PASSWORD_EXPIRED, LOCKED_OUT, SUSPENDED, DEPROVISIONED
```

## Resources

- [Okta Terraform Provider Docs](https://registry.terraform.io/providers/okta/okta/latest/docs)
- [Okta Developer Portal](https://developer.okta.com/)
- [Terraform Documentation](https://www.terraform.io/docs)
- [Okta API Reference](https://developer.okta.com/docs/reference/)

## Support

For issues with:
- **This Terraform config**: Open an issue in the okta-unbound repository
- **Okta provider**: https://github.com/okta/terraform-provider-okta
- **Terraform itself**: https://www.terraform.io/community

## Next Steps

After creating your test environment:

1. **Install the extension** - Follow main README.md installation instructions
2. **Navigate to a test group** - Use URLs from `terraform output group_urls`
3. **Open the extension** - Click the Okta Unbound icon
4. **Test features** - Try cleanup, export, security scan, etc.
5. **Verify results** - Check in Okta admin console
6. **Report issues** - Open GitHub issues for any bugs found

Happy testing! 🚀
