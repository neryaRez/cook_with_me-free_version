module "ecr" {
  source = "../../modules/ecr"

  project_name = var.project_name
  env_name     = var.environment

  repositories = [
    local.backend_repository_name
  ]
}
