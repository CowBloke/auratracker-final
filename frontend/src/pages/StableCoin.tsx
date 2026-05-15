import { CryptoTradingTerminal } from './CryptoTradingTerminal';
import { marketRoomApi } from '../services/api';

const stableCoinApi = marketRoomApi.getCoin('stable-coin');

export default function StableCoin() {
  return (
    <CryptoTradingTerminal
      api={stableCoinApi}
      coinLabel="Aura Stable"
      coinUnit="AUST"
      socketEvent="market-room:stable-coin:price-update"
      initialPrice={100}
    />
  );
}
