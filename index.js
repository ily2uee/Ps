export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Only POST allowed', { status: 405 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, reason: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ ok: false, reason: 'Webhook not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Мат и оскорбления (расширенный список)
    const bannedWords = [
      // English
      "fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nigga",
      "faggot", "slut", "whore", "retard", "dick", "pussy", "cock",
      "bastard", "motherfucker", "dumbass", "jerk", "loser", "idiot",
      "suck my", "kill yourself", "die", "rape", "cum", "balls", "blowjob",
      // Russian
      "сука", "бляд", "еба", "ёб", "пизд", "хуй", "хер", "чмо", "мразь",
      "тварь", "гандон", "пидор", "шлюх", "уёб", "уеб", "муд", "дебил",
      "идиот", "даун", "гей", "лох", "соси"
    ];

    // Проверка на пинги и маты
    function containsPingOrSwear(str) {
      if (!str) return false;
      const lower = str.toLowerCase();
      if (lower.includes('@everyone') || lower.includes('@here') || lower.match(/<@/)) return true;
      for (const w of bannedWords) {
        if (lower.includes(w.toLowerCase())) return true;
      }
      return false;
    }

    // Проверяем обычный контент
    if (typeof payload.content === 'string' && containsPingOrSwear(payload.content)) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Message contains ping or bad words' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Проверяем embeds
    if (Array.isArray(payload.embeds)) {
      for (const embed of payload.embeds) {
        if (!embed) continue;
        const parts = [
          embed.title,
          embed.description,
          embed.footer?.text,
          embed.author?.name,
          ...(embed.fields || []).flatMap(f => [f.name, f.value]),
        ];
        for (const text of parts) {
          if (containsPingOrSwear(text)) {
            return new Response(
              JSON.stringify({ ok: false, reason: 'Embed contains ping or bad words' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    // Если всё чисто — отправляем
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Discord webhook error', status: resp.status }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
