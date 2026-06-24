module "inspector" {
  source = "../../modules/security/inspector"

  enable_inspector = var.enable_inspector
}
