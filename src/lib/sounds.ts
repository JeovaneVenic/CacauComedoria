"use client"

// Sons do sistema, gerados no navegador (sem arquivo de áudio).
// Onda quadrada + compressor para soar alto no alto-falante do tablet.

let ctx: AudioContext | null = null

function audio() {
  ctx ??= new AudioContext()
  // navegadores pausam o áudio até o primeiro toque na tela
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

function tone(ac: AudioContext, out: AudioNode, freq: number, start: number, length: number) {
  // onda quadrada (presença) + seno uma oitava abaixo (corpo)
  ;[
    { type: "square" as OscillatorType, f: freq, level: 0.55 },
    { type: "sine" as OscillatorType, f: freq / 2, level: 0.45 },
  ].forEach(({ type, f, level }) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = type
    osc.frequency.value = f
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(level, start + 0.012)
    gain.gain.setValueAtTime(level, start + length - 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
    osc.connect(gain).connect(out)
    osc.start(start)
    osc.stop(start + length + 0.02)
  })
}

function loudOutput(ac: AudioContext, threshold: number, ratio: number) {
  const compressor = ac.createDynamicsCompressor()
  compressor.threshold.value = threshold
  compressor.knee.value = 6
  compressor.ratio.value = ratio
  compressor.connect(ac.destination)
  return compressor
}

/**
 * Alarme da cozinha (pedido novo): campainha de balcão com dois tons agudos alternados.
 * `repeats` = quantas vezes o par "ti-tum" se repete; o padrão (3x) dura cerca de 1,5 s.
 */
export function playKitchenAlarm(repeats = 3) {
  try {
    const ac = audio()
    const out = loudOutput(ac, -18, 8)
    const t0 = ac.currentTime + 0.03
    for (let i = 0; i < repeats; i++) {
      const base = t0 + i * 0.5
      tone(ac, out, 1318.5, base, 0.17) // Mi6
      tone(ac, out, 987.8, base + 0.2, 0.22) // Si5
    }
  } catch {
    // sem áudio disponível: o aviso visual continua
  }
}

/** Toque do garçom (pedido pronto): dois tons subindo, repetidos 2x */
export function playReadyChime() {
  try {
    const ac = audio()
    const out = loudOutput(ac, -20, 6)
    const t0 = ac.currentTime + 0.03
    ;[0, 0.55].forEach((offset) => {
      tone(ac, out, 880, t0 + offset, 0.16) // Lá5
      tone(ac, out, 1318.5, t0 + offset + 0.18, 0.3) // Mi6
    })
  } catch {
    // sem áudio disponível
  }
}
