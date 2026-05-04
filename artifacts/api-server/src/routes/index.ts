import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.routes.js";
import superadminRouter from "./superadmin.routes.js";
import resellerRouter from "./reseller.routes.js";
import serversRouter from "./servers.routes.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(superadminRouter);
router.use(resellerRouter);
router.use(serversRouter);

export default router;
