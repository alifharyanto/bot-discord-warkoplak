require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, getVoiceConnection } = require('@discordjs/voice');
const { addSpeechEvent } = require('discord-speech-recognition');
const edgeTTS = require('edge-tts-api');
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});
addSpeechEvent(client);

let isTalkingMode = false;
const playlist = [
    path.join(__dirname, 'music', '2.23AM.mp3'), 
    path.join(__dirname, 'music', '3.03PM.mp3')
];
let currentIndex = 0;

client.on('ready', () => console.log(`✅ ${client.user.tag} siap nongkrong!`));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!bicara') {
        isTalkingMode = true;
        return message.reply("🎤 **Mode Bicara AKTIF.** Aku dengerin kamu di VC sekarang.");
    }
    if (message.content === '!berhenti-bicara') {
        isTalkingMode = false;
        return message.reply("🔇 **Mode Bicara MATI.**");
    }

    if (message.content === '!penjaga') {
        const channel = message.member?.voice.channel;
        if (!channel) return message.reply("Masuk VC dulu!");
        connectToVoice(channel);
        message.reply("🛡️ Room dijaga!");
    }

    if (message.content.startsWith('!ai ')) {
        const reply = await getAIResponse(message.content.slice(4));
        message.reply(reply);
    }
});

// --- FITUR MENDENGAR & MERESPON DENGAN SUARA ---
client.on('speech', async (msg) => {
    if (!isTalkingMode || !msg.content) return;

    console.log(`User bicara: ${msg.content}`);
    const aiReply = await getAIResponse(msg.content);
    
    const connection = getVoiceConnection(msg.guild.id);
    if (connection) {
        // TTS pake suara robot Indonesia
        const ttsUrl = edgeTTS.getAudioUrl(aiReply, { lang: 'id-ID', voice: 'id-ID-ArdiNeural' });
        const resource = createAudioResource(ttsUrl);
        const player = createAudioPlayer();
        player.play(resource);
        connection.subscribe(player);
    }
});

async function getAIResponse(prompt) {
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', { // FIXED: URL ke GROQ
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "Kamu asisten Warkoplak, santai, lucu, bot dari FX Intelligence. Jawab singkat." },
                { role: "user", content: prompt }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${process.env.GROK_API_KEY}` } // Key gsk_ kamu masuk sini
        });
        return response.data.choices[0].message.content;
    } catch (e) {
        console.error("AI Error:", e.response?.data || e.message);
        return "Aduh, lagi dapet error 400 nih. Cek API Key!";
    }
}

function connectToVoice(channel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    
    function playNext() {
        if (playlist.length === 0) return;
        const resource = createAudioResource(playlist[currentIndex], { inlineVolume: true });
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