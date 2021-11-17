import { PublishedPack } from '@algomart/schemas'

import BankAccountPurchaseForm from '@/components/bank-account-form/bank-account-form'
import EmailVerfication from '@/components/profile/email-verification'
import PurchaseNFTForm from '@/components/purchase-nft-form/purchase-nft-form'
import { useAuth } from '@/contexts/auth-context'
import { Environment } from '@/environment'
import { isGreaterThanOrEqual } from '@/utils/format-currency'
import { maximumBidForCardPayments } from '@/utils/purchase-validation'

export interface CheckoutTemplateProps {
  auctionPackId: string | null
  currentBid: number | null
  release: PublishedPack
}

export default function CheckoutTemplate({
  auctionPackId,
  currentBid,
  release,
}: CheckoutTemplateProps) {
  const { user } = useAuth()
  if (!user?.emailVerified) {
    return <EmailVerfication inline />
  }
  const doesRequireWirePayment =
    Environment.isWireEnabled &&
    ((currentBid &&
      isGreaterThanOrEqual(currentBid, maximumBidForCardPayments)) ||
      (release.price &&
        isGreaterThanOrEqual(release.price, maximumBidForCardPayments)))
  return (
    <>
      {doesRequireWirePayment ? (
        <BankAccountPurchaseForm
          auctionPackId={auctionPackId}
          currentBid={currentBid}
          release={release}
        />
      ) : (
        <PurchaseNFTForm
          auctionPackId={auctionPackId}
          currentBid={currentBid}
          release={release}
        />
      )}
    </>
  )
}
