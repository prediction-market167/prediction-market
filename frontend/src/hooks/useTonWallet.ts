import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react'
import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from './useStore'
import { setWalletAddress } from '@/store/slices/walletSlice'
import { usersApi } from '@/api/users'

export function useTonWallet() {
  const rawAddress = useTonAddress()
  const [tonConnectUI] = useTonConnectUI()
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)

  useEffect(() => {
    const address = rawAddress || null
    dispatch(setWalletAddress(address))
    // Only sync to backend when the user is authenticated
    if (token) {
      usersApi.updateWallet(address).catch(console.error)
    }
  }, [rawAddress, token, dispatch])

  return {
    address: rawAddress || null,
    connect: () => tonConnectUI.openModal(),
    disconnect: () => tonConnectUI.disconnect(),
  }
}
