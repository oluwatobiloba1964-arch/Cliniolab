import { LoadingState } from '@/components/ui/StateMessage';

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <LoadingState label="Loading" />
    </div>
  );
}
