import {
  CheckoutStatus,
  PaymentStatus,
  PublishedPack,
  ToPaymentBase,
} from '@algomart/schemas'
import useTranslation from 'next-translate/useTranslation'
import { useCallback, useRef, useState } from 'react'

import css from './crypto-form.module.css'

import Button from '@/components/button'
import Heading from '@/components/heading'
import { AlgorandAdapter, ChainType, IConnector } from '@/libs/algorand-adapter'
import { WalletConnectAdapter } from '@/libs/wallet-connect-adapter'
import checkoutService from '@/services/checkout-service'
import { formatToDecimal, isGreaterThanOrEqual } from '@/utils/format-currency'
import { formatFloatToInt } from '@/utils/format-currency'
import { poll } from '@/utils/poll'

const algorand = new AlgorandAdapter(ChainType.TestNet)

const formatAccount = (account: string) =>
  `${account.slice(0, 6)}...${account.slice(-6)}`

export interface CryptoFormWalletConnectProps {
  address: string | null
  setStatus: (status: CheckoutStatus) => void
  price: string | null
  release?: PublishedPack
  setError: (error: string) => void
  setTransfer: (transfer: ToPaymentBase | null) => void
  transfer: ToPaymentBase | null
}

export default function CryptoFormWalletConnect({
  address,
  setStatus,
  price,
  release,
  setError,
  setTransfer,
  transfer,
}: CryptoFormWalletConnectProps) {
  const { t } = useTranslation()
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState<string>('')
  const connectorReference = useRef<IConnector>()

  const connect = useCallback(async () => {
    setConnected(false)

    const connector = (connectorReference.current = new WalletConnectAdapter(
      algorand
    ))

    connector.subscribe('update_accounts', (accounts: string[]) => {
      setAccount(accounts[0])
      setConnected(true)
    })

    await connector.connect()
  }, [])

  const disconnect = useCallback(async () => {
    const connector = connectorReference.current
    if (connector) {
      await connector.disconnect()
      setConnected(false)
      setAccount('')
    }
  }, [])

  const handleWalletConnectPurchase = useCallback(async () => {
    setStatus(CheckoutStatus.loading)
    // If using WalletConnect:
    if (!account || !connected || !address || !price || !release?.templateId) {
      setError(t('forms:errors.invalidDetails'))
      setStatus(CheckoutStatus.error)
      return
    }
    const assetData = await algorand.getAssetData(account)
    const usdcAsset = assetData.find((asset) => asset.unitName === 'USDC')
    if (!usdcAsset) {
      // No USDC asset found
      setError(t('forms:errors.noUSDC'))
      setStatus(CheckoutStatus.error)
      return
    }

    // Check USDC balance
    const usdcBalance = formatToDecimal(usdcAsset.amount, usdcAsset.decimals)
    const usdcBalanceInt = formatFloatToInt(usdcBalance)
    const priceInt = formatFloatToInt(price)
    if (!isGreaterThanOrEqual(usdcBalanceInt, priceInt)) {
      // Not enough USDC
      setError(t('forms:errors.minUSDC', { balance: usdcBalance, min: price }))
      setStatus(CheckoutStatus.error)
      return
    }

    // Submit the transaction to Algorand
    const connector = connectorReference.current
    if (connector) {
      const assetTx = await algorand.makeAssetTransferTransaction({
        amount: priceInt * 10_000,
        from: account,
        to: address,
        assetIndex: usdcAsset.id,
        note: undefined,
        rekeyTo: undefined,
      })
      // User signs transaction and we submit to Algorand network
      const txn = await connector.signTransaction(assetTx)
      if (txn) {
        // Check for pending transfer
        const completeWhenNotPendingForTransfer = (
          transfer: ToPaymentBase | null
        ) => !(transfer?.status !== PaymentStatus.Pending)
        const transferResp = await poll<ToPaymentBase | null>(
          async () =>
            await checkoutService
              .getTransferByAddress(address)
              .catch(() => null),
          completeWhenNotPendingForTransfer,
          1000
        )
        if (!transferResp || transferResp.status === PaymentStatus.Failed) {
          setError(t('forms:errors.transferNotFound'))
          setStatus(CheckoutStatus.error)
          return
        }
        setTransfer(transfer)
      }
    }
  }, [
    account,
    address,
    connected,
    setStatus,
    price,
    release?.templateId,
    setError,
    setTransfer,
    t,
    transfer,
  ])

  const copyToClipboard = useCallback(() => {
    if (navigator) {
      navigator.clipboard.writeText(address as string)
    }
  }, [address])

  return (
    <section className={css.walletConnect}>
      {connected ? (
        <div className={css.connect}>
          <Button onClick={handleWalletConnectPurchase}>
            {t('common:actions.Purchase with Algorand Wallet')}
          </Button>
          <div className={css.connectedAccount}>
            <Heading level={3}>
              {t('forms:fields.payWithCrypto.Connected account')}:
            </Heading>
            <p>{formatAccount(account)}</p>
          </div>
          <Button
            className={css.disconnectButton}
            onClick={disconnect}
            size="small"
            variant="tertiary"
          >
            {t('common:actions.Disconnect')}
          </Button>
        </div>
      ) : (
        <>
          <Button onClick={connect}>
            {t('common:actions.Connect to Algorand Wallet')}
          </Button>
          <div className={css.copyWrapper}>
            <span>{t('common:global.or')}</span>
            <Button
              className={css.copyButton}
              onClick={copyToClipboard}
              variant="tertiary"
            >
              {t('common:actions.Copy to clipboard')}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
