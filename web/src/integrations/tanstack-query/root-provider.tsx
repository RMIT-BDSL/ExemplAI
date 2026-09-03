import { QueryClient } from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { convex } from '#/lib/convex'

export function getContext() {
  const convexQueryClient = new ConvexQueryClient(convex, {
    // All course/lesson data is auth-gated and the server has no user token,
    // so a "consistent" SSR read just costs an extra round-trip before failing
    // auth and falling back to the skeleton. Skip the consistency handshake.
    dangerouslyUseInconsistentQueriesDuringSSR: true,
  })

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)

  return {
    queryClient,
    convexQueryClient,
  }
}
export default function TanstackQueryProvider() {}
