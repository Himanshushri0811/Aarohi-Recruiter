import { Request, Response } from 'express';
import { success } from '../../common/utils/helpers.js';
import { AuthenticatedRequest } from '../../common/types/index.js';
import { createOrgSchema, updateOrgSchema } from './organizations.schemas.js';
import * as orgService from './organizations.service.js';

export async function create(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const input = createOrgSchema.parse(req.body);

  const org = await orgService.createOrganization(authReq.user.sub, input, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json(success(org));
}

export async function list(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const orgs = await orgService.listUserOrganizations(authReq.user.sub);

  res.status(200).json(success(orgs));
}

export async function get(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const org = await orgService.getOrganization(req.params.orgId, authReq.user.sub);

  res.status(200).json(success(org));
}

export async function update(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const input = updateOrgSchema.parse(req.body);

  const org = await orgService.updateOrganization(
    req.params.orgId,
    authReq.user.sub,
    input,
    {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  );

  res.status(200).json(success(org));
}
