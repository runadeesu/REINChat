// STUN is free and needs no account (Google's public servers). TURN is
// optional — without it, calls between two peers behind strict/symmetric
// NATs (common on mobile carrier networks and some corporate networks)
// may fail to connect. Set NEXT_PUBLIC_TURN_* to add one.
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }

  return servers;
}

export function hasTurnConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURN_URL);
}
