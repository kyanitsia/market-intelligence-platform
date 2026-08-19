import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

import { CurrentUser } from './current-user.decorator';

function getDecoratorFactory(decorator: () => ParameterDecorator) {
  class TestController {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    handler(@decorator() _user: unknown) {}
  }

  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    'handler',
  ) as Record<string, { factory: (...args: unknown[]) => unknown }>;

  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser', () => {
  it('reads the authenticated user from the request', () => {
    const user = { id: 'user-id', email: 'test@example.com' };
    const factory = getDecoratorFactory(CurrentUser);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;

    expect(factory(undefined, context)).toEqual(user);
  });
});
