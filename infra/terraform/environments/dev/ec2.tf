locals {
  backend_image = "${module.ecr.repository_urls[local.backend_repository_name]}:latest"
  ecr_registry  = split("/", module.ecr.repository_urls[local.backend_repository_name])[0]

  backend_cors_allowed_origins = join(",", compact([
    local.cloudfront_frontend_base_url,
    local.custom_domain_enabled ? local.custom_frontend_base_url : null
  ]))
}

module "backend_ec2" {
  source = "../../modules/compute/ec2-docker-host"

  name                      = "${local.name_prefix}-backend"
  ami_id                    = data.aws_ssm_parameter.amazon_linux_2023.value
  instance_type             = var.instance_type
  subnet_id                 = data.aws_subnets.default.ids[0]
  security_group_ids        = [aws_security_group.backend.id]
  iam_instance_profile_name = aws_iam_instance_profile.ec2.name

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    aws_region           = var.aws_region
    app_secret_name      = var.app_secret_name
    backend_image        = local.backend_image
    ecr_registry         = local.ecr_registry
    cors_allowed_origins = local.backend_cors_allowed_origins
  })

  tags = local.common_tags
}
