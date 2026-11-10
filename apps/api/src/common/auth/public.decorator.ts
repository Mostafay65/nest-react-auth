import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE = 'isPublicRoute';

/**
 * Opts a route out of the global access-token guard. Routes are protected by
 * default, so a new endpoint can't be exposed by forgetting a decorator.
 */
export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);
