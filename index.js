require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, getVoiceConnection } = require('@discordjs/voice');
const { addSpeechEvent } = require('discord-speech-recognition');
const edgeTTS = require('edge-tts-api');
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
app.get('/', (req, res) => res.send('Warkoplak Bot is Online!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});
addSpeechEvent(client); // Mengaktifkan fitur mendengar suara

let isTalkingMode = false;
const playlist = [
    path.join(__dirname, 'music', '2.23AM.mp3'),
    path.join(__dirname, 'music', '3.03PM.mp3')
];
let currentIndex = 0;

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} siap nongkrong di Warkoplak!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- KONTROL MODE BICARA ---
    if (message.content === '!bicara') {
        isTalkingMode = true;
        return message.reply("🎤 **Mode Bicara AKTIF.** Aku dengerin kamu di VC sekarang.");
    }
    if (message.content === '!berhenti-bicara') {
        isTalkingMode = false;
        return message.reply("🔇 **Mode Bicara MATI.**");
    }

    // --- FITUR PENJAGA (MASUK VC) ---
    if (message.content === '!penjaga') {
        const channel = message.member?.voice.channel;
        if (!channel) return message.reply("Masuk VC dulu, Bos!");
        connectToVoice(channel);
        message.reply(`🛡️ **Standby!** Jagain room **${channel.name}**.`);
    }

    // --- FITUR KELUAR ---
    if (message.content === '!keluar') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply("👋 Cabut dulu!");
        }
    }

    // --- FITUR CHAT AI (!ai) ---
    if (message.content.startsWith('!ai ')) {
        const prompt = message.content.slice(4);
        const reply = await getAIResponse(prompt);
        message.reply(reply);
    }
});

// --- FITUR MENDENGAR SUARA DI VC ---
client.on('speech', async (msg) => {
    if (!isTalkingMode || !msg.content) return;

    console.log(`Dengar suara: ${msg.content}`);
    const aiReply = await getAIResponse(msg.content);

    const connection = getVoiceConnection(msg.guild.id);
    if (connection) {
        // Mengubah teks balasan AI jadi suara (TTS)
        const ttsUrl = edgeTTS.getAudioUrl(aiReply, { lang: 'id-ID', voice: 'id-ID-ArdiNeural' });
        const resource = createAudioResource(ttsUrl);
        const player = createAudioPlayer();
        player.play(resource);
        connection.subscribe(player);
    }
});

// --- FUNGSI AI (FIX URL GROQ) ---
async function getAIResponse(prompt) {
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "Kamu asisten Warkoplak dari FX Intelligence. Gaya santai, singkat, mengikuti suasana obrolan, bahasa nya gaul, jika petanyaan ilmu jawab singkat saja agar tidak melebihi teks token dan jawab ringan santai, jika kamu ditanya kamu siapa kamu adalah bot ai discord warkoplak dari FX Intelligence  " },
                { role: "user", content: prompt }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROK_API_KEY}`, // Key gsk_ masuk sini
                'Content-Type': 'application/json'
            }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        console.error("Error API:", err.response?.data || err.message);
        return "Duh, otakku korslet. Cek koneksi atau API Key!";
    }
}

function connectToVoice(channel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });

    function playNext() {
        const trackPath = playlist[currentIndex];
        const resource = createAudioResource(trackPath, { inlineVolume: true });
        resource.volume.setVolume(0.3);
        player.play(resource);
        currentIndex = (currentIndex + 1) % playlist.length;
    }

    playNext();
    connection.subscribe(player);
    player.on(AudioPlayerStatus.Idle, playNext);
}

client.login(process.env.TOKEN);

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

module.exports = client;