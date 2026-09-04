import eos from '@/assets/chains/eos.png';
import jungle from '@/assets/chains/jungle.png';
import wax from '@/assets/chains/wax.png';
import telos from '@/assets/chains/telos.png';
import proton from '@/assets/chains/proton.png';
import protonTestnet from '@/assets/chains/proton-testnet.png';
import libre from '@/assets/chains/libre.png';

const logos: Record<string, string> = {
  eos,
  jungle4: jungle,
  wax,
  'wax-testnet': wax,
  telos,
  'telos-testnet': telos,
  proton,
  'proton-testnet': protonTestnet,
  libre,
  'libre-testnet': libre,
};

export function chainLogo(id: string): string | undefined {
  return logos[id];
}
