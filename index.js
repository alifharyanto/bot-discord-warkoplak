require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, getVoiceConnection } = require('@discordjs/voice');
const { addSpeechEvent } = require('discord-speech-recognition');
const { MsEdgeTTS } = require('ms-edge-tts'); // Fix library name
const express = require('express');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

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

addSpeechEvent(client); 
const tts = new MsEdgeTTS();

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

// --- EVENT SPEECH (MENDENGAR & TTS) ---
client.on('speech', async (msg) => {
    if (!isTalkingMode || !msg.content) return;

    console.log(`Dengar: ${msg.content}`);
    const aiReply = await getAIResponse(msg.content);
    const connection = getVoiceConnection(msg.guild.id);

    if (connection) {
        const filePath = path.join(__dirname, 'tts.mp3');
        try {
            // Set suara Cowok Indonesia (Ardi)
            await tts.setMetadata("id-ID-ArdiNeural", "audio-24khz-48kbitrate-mono-mp3");
            await tts.toFile(filePath, aiReply);
            
            const resource = createAudioResource(filePath);
            const player = createAudioPlayer();
            player.play(resource);
            connection.subscribe(player);
        } catch (err) {
            console.error("Gagal memproses TTS:", err);
        }
    }
});

// --- FUNGSI AI (GROQ LLAMA 3.3) ---
async function getAIResponse(prompt) {
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { 
                    role: "system", 
                    content: "Kamu asisten Warkoplak dari FX Intelligence. Gaya santai, singkat, mengikuti suasana obrolan, bahasanya gaul, jika pertanyaan ilmu jawab singkat saja agar tidak melebihi teks token dan jawab ringan santai. Jika kamu ditanya kamu siapa kamu adalah bot ai discord warkoplak dari FX Intelligence." 
                },
                { role: "user", content: prompt }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        return response.data.choices[0].message.content;
    } catch (err) {
        console.error("Error API:", err.response?.data || err.message);
        return "Duh, otakku korslet. Cek koneksi atau API Key!";
    }
}

// --- FUNGSI MUSIK PENJAGA ---
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
        
        // Cek file ada atau tidak
        if (!fs.existsSync(trackPath)) {
            console.error(`File musik tidak ditemukan: ${trackPath}`);
            return;
        }

        const resource = createAudioResource(trackPath, { inlineVolume: true });
        resource.volume.setVolume(0.3);
        player.play(resource);
        console.log(`🎵 Muter lagu: ${path.basename(trackPath)}`);
        currentIndex = (currentIndex + 1) % playlist.length;
    }

    playNext();
    connection.subscribe(player);
    player.on(AudioPlayerStatus.Idle, playNext);
}

// --- ERROR HANDLING ---
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

client.login(process.env.TOKEN);