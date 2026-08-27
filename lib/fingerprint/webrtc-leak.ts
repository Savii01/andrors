/**
 * WebRTC Proxy-Piercing & Real IP Detection
 * Uses native RTCPeerConnection with public Google STUN server.
 * Costs $0 — no external services required.
 */

export interface WebrtcResult {
  candidateIp: string | null;
  available: boolean;
}

const STUN_SERVER = 'stun:stun.l.google.com:19302';
const TIMEOUT_MS = 2000;

/**
 * Attempt to extract a public candidate IP via WebRTC.
 * Returns null if WebRTC is unavailable or times out.
 */
export function detectWebrtcIp(): Promise<WebrtcResult> {
  if (typeof RTCPeerConnection === 'undefined') {
    return Promise.resolve({ candidateIp: null, available: false });
  }

  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { pc.close(); } catch {}
        resolve({ candidateIp: null, available: true });
      }
    }, TIMEOUT_MS);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: STUN_SERVER }],
      iceCandidatePoolSize: 0,
    });

    pc.createDataChannel('');
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => {
        clearTimeout(timer);
        resolved = true;
        resolve({ candidateIp: null, available: false });
      });

    pc.onicecandidate = (event) => {
      if (resolved || !event.candidate) return;

      const candidate = event.candidate.candidate;
      const ipMatch = candidate.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);

      if (ipMatch) {
        const ip = ipMatch[1];
        if (!isPrivateIp(ip)) {
          resolved = true;
          clearTimeout(timer);
          pc.close();
          resolve({ candidateIp: ip, available: true });
        }
      }
    };

    pc.onicecandidateerror = () => {};
  });
}

function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return true;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  );
}
