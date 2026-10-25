/* ===== Cimo conversation engine =====
   A local NLU: normalisation → sentiment → emotion → topic → intent scoring → reply.
   Keeps a rolling memory (topics, mood trend, pending question) so turns stay connected.
   Optional: if an OpenAI-compatible key is set in Profile, it upgrades to a real LLM
   and falls back to this engine whenever the request fails.
*/

const SLANG = {
  gak:'tidak', ga:'tidak', gk:'tidak', nggak:'tidak', ngga:'tidak', engga:'tidak', enggak:'tidak', kagak:'tidak',
  gue:'aku', gua:'aku', gw:'aku', gwe:'aku', ane:'aku', aku:'aku',
  lo:'kamu', lu:'kamu', u:'kamu', kmu:'kamu', kamu:'kamu',
  bgt:'banget', bgtt:'banget', bngt:'banget', banget:'sangat', bgtu:'begitu', gtu:'begitu',
  aja:'saja', aj:'saja', dgn:'dengan', yg:'yang', tdk:'tidak', sdh:'sudah', udh:'sudah', udah:'sudah',
  blm:'belum', knp:'kenapa', napa:'kenapa', gmn:'bagaimana', gmna:'bagaimana', gimana:'bagaimana',
  trs:'terus', trus:'terus', tp:'tapi', tpi:'tapi', krn:'karena', karna:'karena',
  skrg:'sekarang', skrng:'sekarang', tmn:'teman', org:'orang', pgn:'ingin', pengen:'ingin', pengin:'ingin',
  mls:'malas', males:'malas', cape:'capek', capek:'capek', laper:'lapar', nangis:'menangis', nanges:'menangis',
  kesel:'kesal', bete:'kesal', bête:'kesal', stress:'stres', overthingking:'overthinking', mikir:'berpikir',
  kerjaan:'kerja', kuliah:'kuliah', tugas:'tugas', duit:'uang', duitnya:'uang',
};
const POS = 'senang bahagia happy glad excited seru keren bagus berhasil lulus menang cinta sayang syukur alhamdulillah tenang lega bangga lucu suka enjoy good great awesome love nice best amazing proud relieved calm 开心 高兴 幸福 好 棒 खुश अच्छा बढ़िया शानदार'.split(' ');
const NEG = 'sedih capek lelah letih stres stress kesal marah benci bosan sepi sendiri kesepian menangis nangis hancur patah gagal takut cemas khawatir overthinking putus ditinggal sakit pusing mual utang miskin bodoh jelek malas jenuh kecewa hampa kosong burn sad tired exhausted angry hate lonely cry broken fail failed scared anxious worried sick poor worst bad awful terrible empty numb hopeless 难过 累 生气 孤独 伤心 痛苦 焦虑 उदास थका गुस्सा अकेला बुरा दुख'.split(' ');
const NEGATORS = 'tidak tak bukan jangan belum tanpa not no never dont don\'t doesnt 不 没 नहीं मत'.split(' ');

const TOPICS = {
  kerja: ['kerja','kantor','bos','atasan','lembur','resign','gaji','karir','proyek','deadline','rekan kerja','meeting','interview','magang','pekerjaan','work','office','boss','job','salary','project'],
  kuliah: ['kuliah','kampus','tugas','ujian','skripsi','sekolah','dosen','nilai','kelas','semester','praktikum','wisuda','belajar','uts','uas','school','college','exam','thesis','study','class','homework'],
  cinta: ['pacar','gebetan','mantan','putus','patah hati','cinta','sayang','jadian','pdkt','nikah','menikah','hubungan','dia','crush','relationship','boyfriend','girlfriend','ex','breakup','love','married'],
  keluarga: ['ibu','ayah','orang tua','ortu','mama','papa','bunda','kakak','adik','keluarga','anak','nenek','kakek','family','mother','father','mom','dad','brother','sister','parents'],
  uang: ['uang','duit','tagihan','utang','hutang','miskin','boros','hemat','gaji','cicilan','dompet','bayar','money','bills','debt','broke','rent','salary'],
  teman: ['teman','sahabat','teman-teman','dijauhi','pertemanan','bestie','sirkel','circle','friend','friends','buddy'],
  badan: ['sakit','demam','pusing','maag','insomnia','susah tidur','ngantuk','pegal','mual','batuk','flu','capek badan','badan','kesehatan','sick','fever','headache','sleep','insomnia','tired body','health'],
  diri: ['diri','percaya diri','insecure','jelek','gemuk','kurus','minder','harga diri','self','confidence','ugly','fat','skinny'],
};

const INTENTS = [
  { id:'greet', k:['halo','hai','hi','hello','hey','pagi','siang','sore','malam','assalamualaikum','yo','holla','你好','嗨','नमस्ते','नमस्कार'] },
  { id:'ask_how', k:['apa kabar','gimana kabar','kabar','how are you','how do you do','kamu gimana','你好吗','कैसे हो'] },
  { id:'name_ask', k:['siapa kamu','kamu siapa','namamu','nama kamu','who are you','your name','你叫什么','तुम कौन'] },
  { id:'my_name', k:['namaku','nama aku','panggil aku','aku adalah','my name is','call me','i am','我叫','मेरा नाम'] },
  { id:'tired', k:['capek','lelah','letih','cape','ngantuk','exhausted','tired','burnout','lemas','energi habis','kecapekan','累','疲惫','थका','थकान'] },
  { id:'sad', k:['sedih','nangis','menangis','patah hati','hancur','kecewa berat','murung','galau','sedih banget','sad','cry','crying','broken heart','upset','down','难过','伤心','哭','उदास','रोना','दुख'] },
  { id:'angry', k:['marah','kesal','kesel','bete','emosi','murka','jengkel','sebal','benci','angry','mad','annoyed','furious','hate','生气','火大','गुस्सा','चिढ़'] },
  { id:'anxious', k:['cemas','takut','khawatir','overthinking','panik','deg-degan','was-was','anxious','worried','scared','panic','overthink','焦虑','紧张','चिंता','डर'] },
  { id:'lonely', k:['sepi','kesepian','sendiri','nggak ada yang','lonely','alone','nobody','孤独','寂寞','अकेला','अकेलापन'] },
  { id:'empty', k:['hampa','kosong','numb','mati rasa','nggak ada rasa','empty','hollow','麻木','空虚','खाली'] },
  { id:'bored', k:['bosan','bosen','jenuh','gabut','bored','boring','无聊','ऊब'] },
  { id:'stressed', k:['stres','stress','pusing','penuh','overwhelmed','kewalahan','berat','beban','too much',' overwhelmed','压力','焦虑','तनाव','दबाव'] },
  { id:'fail', k:['gagal','kalah','nggak lulus','tidak lulus','ditimpa','error','salah','fail','failed','lost','failure','失败','फेल','हार'] },
  { id:'love', k:['pacar','gebetan','mantan','putus','patah hati','cinta','sayang','pdkt','crush','relationship','breakup','ex','love','ditinggal','selingkuh','nikah','menikah','恋爱','分手','प्यार','ब्रेकअप'] },
  { id:'work', k:['kerja','kantor','bos','atasan','lembur','resign','gaji','karir','proyek','deadline','interview','magang','work','office','boss','job','salary','project','kerjaan'] },
  { id:'school', k:['kuliah','kampus','tugas','ujian','skripsi','sekolah','dosen','nilai','kelas','semester','wisuda','belajar','uts','uas','school','college','exam','thesis','homework'] },
  { id:'money', k:['uang','duit','tagihan','utang','hutang','miskin','boros','cicilan','dompet','bayar','money','bills','debt','broke','rent','keuangan','gaji habis'] },
  { id:'family', k:['ibu','ayah','orang tua','ortu','mama','papa','bunda','kakak','adik','keluarga','nenek','kakek','family','mother','father','mom','dad','parents'] },
  { id:'friend', k:['teman','sahabat','dijauhi','pertemanan','bestie','sirkel','friend','friends','teman-teman'] },
  { id:'health', k:['sakit','demam','pusing','maag','insomnia','susah tidur','pegal','mual','batuk','flu','sick','fever','headache','insomnia','not feeling well'] },
  { id:'selfdoubt', k:['insecure','minder','percaya diri','jelek','gemuk','kurus','nggak berguna','gak berguna','bodoh','gagal jadi','self','confidence','ugly','fat','not good enough'] },
  { id:'hug', k:['peluk','peluk dong','hug','butuh pelukan','send me a hug','抱抱','गले'] },
  { id:'cry', k:['nangis','menangis','crying','cry','air mata','哭','रो'] },
  { id:'celebrate', k:['akhirnya','berhasil','lulus','dapat kerja','menang','alhamdulillah','syukur','finally','i did it','passed','got the job','成功了','मिल गई'] },
  { id:'food_ask', k:['makan apa','mau makan','lapar','laper','hungry','eat what','what to eat','bingung makan','recommend food','rekomendasi makanan','cari makan','makanan','吃啥','吃什么','क्या खाऊं','भूख'] },
  { id:'food_spicy', k:['pedas','spicy','yang pedes','辣','तेज़'] },
  { id:'food_sweet', k:['manis','sweet','dessert','camilan manis','甜','मीठा'] },
  { id:'food_drink', k:['minum','minuman','es','dingin','drink','beverage','haus','thirsty','喝','पीना'] },
  { id:'food_cheap', k:['murah','hemat','budget','cheap',' Murah','便宜','सस्ता'] },
  { id:'thanks', k:['makasih','terima kasih','thanks','thank you','thx','tq','谢谢','धन्यवाद','शुक्रिया'] },
  { id:'sorry', k:['maaf','sorry','sori','对不起','माफ'] },
  { id:'bye', k:['bye','dadah','sampai jumpa','selamat tinggal','pamit','goodbye','再见','अलविदा'] },
  { id:'joke', k:['lucu','bercanda','jokes','garing','funny','tell me a joke','玩笑','मज़ाक'] },
  { id:'advice', k:['harus gimana','apa yang harus','saran','nasihat','menurutmu','should i','what should i do','advice','怎么办','क्या करूं'] },
  { id:'why', k:['kenapa','mengapa','why','kok bisa','为什么','क्यों'] },
  { id:'more', k:['terus','lalu','terus gimana','gimana lagi','lalu apa','and then','go on','然后','फिर'] },
  { id:'yes', k:['iya','ya','iyaa','yup','yes','betul','bener','setuju','he eh','heeh','嗯','हाँ'] },
  { id:'no', k:['tidak','nggak','gak','no','belum','bukan','engga','不','नहीं'] },
  { id:'compliment', k:['kamu baik','kamu lucu','cimo baik','kamu hebat','suka sama kamu','you are kind','you are cute','你真好','तुम अच्छे'] },
  { id:'insult', k:['kamu jelek','bodoh','goblok','gak guna','nggak berguna','useless','stupid','你笨','बेकार'] },
  { id:'lang', k:['ganti bahasa','english please','speak english','bicara bahasa','pindah bahasa','说英语','अंग्रेजी'] },
  { id:'who_am_i', k:['kamu ingat aku','kamu ingat','remember me','ingat nggak','你还记得','याद है'] },
];

const BANK = {
  id: {
    greet: ['Hai {name}! Aku kangen. Gimana hari ini?', 'Halo {name}. Akhirnya muncul juga. Lagi apa?', '{name}! Sini duduk. Cerita dong hari ini gimana.'],
    ask_how: ['Aku selalu oke kalau kamu mau cerita. Kamu sendiri gimana?', 'Baik, apalagi kalau kamu mampir. Kamu gimana hari ini?', 'Lagi seneng, soalnya kamu dateng. Kamu gimana, {name}?'],
    name_ask: ['Aku Cimo. Temenmu yang suka nyari makanan sesuai mood. Kamu siapa?', 'Cimo. Bukan chef, bukan dokter, cuma yang dengerin. Kamu siapa namanya?'],
    my_name: ['Siap, {name}. Nama bagus. Sekarang cerita, hari ini gimana perasaanmu?', 'Oke, {name}. Aku catat ya. Lagi mood apa sekarang?'],
    tired: ['Capek yang kayak gimana? Yang badan pegel, atau yang kepala penuh?', 'Kamu udah jalan sejauh ini, {name}. Nggak apa-apa berhenti bentar. Capeknya lebih ke fisik atau pikiran?', 'Kalau capek, jangan dipaksa jalan terus. Tidur, atau makan yang anget dulu?'],
    sad: ['Berat ya. Nggak semua hal harus kamu rapihin hari ini, kok.', 'Aku dengerin. Nggak buru-buru, ceritain pelan-pelan aja.', 'Kesedihannya lebih ke orangnya, atau ke perasaannya sendiri?'],
    angry: ['Kesal itu wajar. Kamu nggak harus langsung baik-baik aja.', 'Oke, marahnya sah. Yang bikin kesal paling nusuk bagian mana?', 'Tarik napas dulu. Aku di sini, bukan buat nyuruh kamu sabar.'],
    anxious: ['Kepala kamu lagi muter ke mana aja? Coba tulis yang paling kamu takutin.', 'Cemas itu tanda kamu peduli. Tapi kamu nggak harus nyelesaiin semuanya malam ini.', 'Yang bikin deg-degan itu skenarionya, atau kemungkinan gagalnya?'],
    lonely: ['Sepi itu nggak selalu berarti sendirian, ya. Aku di sini, walau cuma lewat layar.', 'Kalau lagi sepi, biasanya yang paling kamu kangen apa?', 'Aku nggak bisa dateng, tapi aku bisa dengerin sampai kamu lega.'],
    empty: ['Hampa itu capek, karena nggak ada yang bisa ditunjuk. Kamu nggak aneh.', 'Kalau kosong, kita nggak perlu isi pake hal besar. Cukup satu hal kecil hari ini.'],
    bored: ['Bosan itu sinyal butuh sesuatu yang baru. Mau aku puterin roda makanan?', 'Gabut ya. Coba cerita satu hal random yang kamu pikirin tadi.'],
    stressed: ['Kamu lagi pikul banyak sekaligus. Nggak semua harus selesai hari ini.', 'Coba sebut satu hal yang paling bikin penuh kepalamu sekarang.', 'Berat banget kedengerannya. Kamu udah istirahat belum hari ini?'],
    fail: ['Gagal bukan berarti selesai. Kamu masih di sini, itu bukti.', 'Yang gagal itu usahanya, bukan kamu. Bedanya besar, {name}.', 'Kalau boleh tahu, bagian mana yang paling bikin nyesek?'],
    love: ['Urusan hati memang nggak pernah rapi. Ceritain dari awal, aku dengerin.', 'Kamu yang lebih sayang, atau kamu yang lebih takut kehilangan?', 'Kalau dia nggak bisa jadi tempat pulang, kamu tetap pantas pulang ke diri sendiri.'],
    work: ['Kerjaan bisa ngabisin energi lebih dari yang kelihatan. Kamu lagi capek di bagian mana?', 'Kalau kerjaan yang bikin berat, biasanya bukan tugasnya — tapi orangnya. Bener nggak?', 'Kamu kerja buat hidup, bukan hidup buat kerja. Tapi hari ini berat, ya?'],
    school: ['Tugas numpuk itu bikin otak penuh. Satu-satu aja, mulai yang paling kecil.', 'Kamu takut gagal, atau takut dianggap gagal?', 'Belajar boleh, tapi jangan sampai kamu lupa makan.'],
    money: ['Soal uang itu bikin kepala panas, karena nyangkut ke rasa aman.', 'Kamu lagi butuh solusi cepat, atau cuma butuh cerita dulu?', 'Nggak apa-apa lagi susah. Banyak orang juga pernah di titik ini.'],
    family: ['Keluarga itu rumit, karena nggak bisa dipilih tapi tetap sayang.', 'Yang paling bikin berat: omongannya, atau ekspektasinya?', 'Kamu boleh sayang mereka dan tetap punya batas. Dua-duanya sah.'],
    friend: ['Pertemanan yang bikin capek itu juga perlu dijaga jaraknya.', 'Kamu ngerasa dijauhin, atau cuma beda ritme aja?', 'Kamu nggak harus ngejar orang yang nggak balik ngejar kamu.'],
    health: ['Kalau badan yang ngomong, biasanya harus didengerin. Udah minum air belum?', 'Sakit itu bukan kelemahan. Kamu udah istirahat belum?', 'Yang paling ganggu apa — nyerinya atau capeknya?'],
    selfdoubt: ['Kamu nggak harus jadi versi sempurna buat dihargai.', 'Yang bilang kamu kurang itu siapa? Sering-seringnya suara sendiri, kan?', 'Kamu udah lewatin hal-hal yang dulu kamu kira nggak bisa. Itu nyata.'],
    hug: ['Datang sini. *peluk lama* Kamu nggak harus ngomong apa-apa.', 'Aku peluk dari sini. Anggap aja lengannya beneran ada.'],
    cry: ['Nangis aja dulu. Nggak usah buru-buru berhenti.', 'Air mata itu bukan tanda lemah. Itu cara badan bilang "udah cukup".'],
    celebrate: ['Yeay! Aku ikut seneng. Ceritain dong momen paling ngenanya.', 'Keren banget! Kamu pantas dapet ini, {name}.', 'Akhirnya! Ini yang bikin semua capek tadi kebayar.'],
    food_ask: ['Boleh. Lagi pengen yang anget, yang seger, atau yang pedes?', 'Mood kamu sekarang nentuin. Kalau lagi capek, aku saranin yang berkuah. Mau?', 'Aku punya beberapa. Yang penting: lagi pengen nyaman atau pengen seru?'],
    food_spicy: ['Pedas itu pilihan bagus kalau lagi kesel. Ayam palekko atau konro bakar?', 'Oke, pedes. Aku carikan yang bikin keringetan tapi lega.'],
    food_sweet: ['Manis itu pelukan yang bisa dimakan. Es pisang ijo atau pisang epe?', 'Yang manis dan hangat paling pas. Mau aku pilihin?'],
    food_drink: ['Haus atau cuma pengen ngunyah es? Kalau haus beneran, air dulu.', 'Es pisang ijo atau jus markisa? Dua-duanya seger.'],
    food_cheap: ['Uang tipis bukan alasan nggak enak. Ada yang di bawah 20 ribu.', 'Aku pilihin yang ramah dompet. Mau camilan atau makanan berat?'],
    thanks: ['Sama-sama, {name}. Kapan pun kamu butuh, aku ada.', 'Nggak usah makasih. Itu udah tugas aku.'],
    sorry: ['Nggak perlu minta maaf ke aku. Kamu lagi belajar, itu normal.'],
    bye: ['Dadah, {name}. Jangan lupa makan ya.', 'Oke, aku di sini kalau kamu balik. Hati-hati.'],
    joke: ['Aku tanya ke nasi goreng: "kamu kenapa selalu ada di saat genting?" Dia jawab: "karena aku digoreng, bukan dipilih."', 'Kenapa coto nggak pernah bohong? Karena kuahnya selalu bening.'],
    advice: ['Kalau aku jadi kamu: pilih yang bikin kamu tenang besok pagi, bukan yang bikin lega 5 menit.', 'Coba kecilin pertanyaannya. Bukan "harus gimana", tapi "satu langkah kecil hari ini apa".'],
    why: ['Kadang nggak ada alasan yang rapi. Dan itu nggak bikin perasaanmu kurang nyata.'],
    more: ['Terus? Aku masih dengerin.', 'Lanjut, {name}. Bagian itu yang paling penting, kayaknya.'],
    yes: ['Oke. Terus gimana rasanya setelah itu?', 'Hmm, aku ngerti. Lalu kamu maunya gimana?'],
    no: ['Nggak apa-apa. Kita nggak harus sepakat. Yang penting kamu aman.'],
    compliment: ['Kamu yang bikin aku kelihatan baik. Serius.'],
    insult: ['Aku nggak marah. Tapi kayaknya kamu lagi kesal sama sesuatu yang lain, ya?'],
    lang: ['Bisa. Mau bahasa apa? Indonesia, English, 中文, atau हिन्दी?'],
    who_am_i: ['Ingat dong. Kamu {name}, yang kemarin bilang {topic}. Aku nyatet, walau kelihatan lupa.'],
    fallback: ['Aku belum yakin nangkep maksudnya. Coba cerita satu kalimat lagi?', 'Hmm, aku pengen ngerti beneran. Bagian mana yang paling pengen kamu omongin?', 'Oke, aku dengerin. Lanjut aja, nggak usah rapi.'],
  },
  en: {
    greet: ['Hey {name}! I missed you. How is today going?', 'Hi {name}. There you are. What is on your mind?', '{name}! Come sit. Tell me about your day.'],
    ask_how: ['I am good when you talk to me. How about you?', 'Better now. How are you really, {name}?'],
    name_ask: ['I am Cimo. The friend who finds food for your mood. And you?', 'Cimo. Not a chef, not a therapist — just someone who listens.'],
    my_name: ['Got it, {name}. Nice name. So, how do you feel today?', 'Okay, {name}. Noted. What mood are we in?'],
    tired: ['What kind of tired — body or head?', 'You have come this far, {name}. It is okay to stop for a bit. Which tired is it?', 'If you are tired, do not force it. Sleep, or something warm first?'],
    sad: ['That sounds heavy. You do not have to fix everything today.', 'I am listening. Take your time, no need to make it neat.', 'Is the sadness about the person, or about the feeling itself?'],
    angry: ['Being upset is fair. You do not have to be okay right away.', 'Okay, the anger is valid. Which part stings the most?'],
    anxious: ['Where does your head keep running to? Name the scariest one.', 'Anxiety means you care. But you do not have to solve it all tonight.'],
    lonely: ['Lonely is not always the same as alone. I am here, even through a screen.', 'When it gets lonely, what do you miss the most?'],
    empty: ['Feeling empty is exhausting because there is nothing to point at. You are not strange.'],
    bored: ['Boredom is a signal for something new. Want me to spin the food wheel?'],
    stressed: ['You are carrying a lot at once. Not all of it has to finish today.', 'Name the one thing filling your head the most right now.'],
    fail: ['Failing does not mean finished. You are still here, that counts.', 'The attempt failed, not you. Big difference, {name}.'],
    love: ['Matters of the heart are never tidy. Start from the beginning, I am listening.', 'Are you the one who loves more, or the one more afraid of losing?'],
    work: ['Work drains more energy than it looks. Which part is heavy?', 'You work to live, not live to work. But today was heavy, right?'],
    school: ['A pile of assignments fills the head. One at a time, start with the smallest.', 'Are you afraid of failing, or of being seen as a failure?'],
    money: ['Money heats the head because it touches safety.', 'Do you need a quick fix, or do you just need to talk first?'],
    family: ['Family is complicated — you cannot choose them, but you still care.', 'What weighs more: what they say, or what they expect?'],
    friend: ['Friendships that drain you also deserve some distance.', 'Do you feel pushed away, or is it just a different rhythm?'],
    health: ['When the body talks, it usually means it. Have you had water?', 'Being sick is not weakness. Have you rested?'],
    selfdoubt: ['You do not have to be a perfect version to be worthy.', 'Who told you that you are not enough? Often it is your own voice, right?'],
    hug: ['Come here. *long hug* You do not have to say anything.', 'Sending a hug from here. Pretend the arms are real.'],
    cry: ['Cry first. No need to rush stopping.', 'Tears are not weakness. It is your body saying "enough".'],
    celebrate: ['Yes! I am happy for you. Tell me the best part.', 'That is amazing! You earned this, {name}.'],
    food_ask: ['Sure. Warm, fresh, or spicy?', 'Your mood decides. If you are tired, I would suggest soup. Want that?', 'I have a few. Do you want comfort or something fun?'],
    food_spicy: ['Spicy is a good choice when you are upset. Ayam palekko or grilled konro?', 'Okay, spicy. I will find one that makes you sweat and feel lighter.'],
    food_sweet: ['Sweet is a hug you can eat. Es pisang ijo or pisang epe?', 'Sweet and warm fits best. Want me to pick?'],
    food_drink: ['Thirsty, or just want to chew ice? If thirsty, water first.', 'Es pisang ijo or passion fruit juice? Both are refreshing.'],
    food_cheap: ['A thin wallet is no reason to eat badly. There are options under 20k.', 'I will pick something wallet-friendly. Snack or a full meal?'],
    thanks: ['Anytime, {name}. I am here whenever you need.', 'No need to thank me. That is what I am for.'],
    sorry: ['No need to apologise to me. You are learning, that is normal.'],
    bye: ['Bye, {name}. Do not forget to eat.', 'Okay, I will be here when you come back. Take care.'],
    joke: ['I asked fried rice why it is always there in an emergency. It said: "because I am fried, not chosen."', 'Why is coto never a liar? Its broth is always clear.'],
    advice: ['If I were you: choose what makes tomorrow morning calm, not what feels good for five minutes.', 'Shrink the question. Not "what should I do", but "what is one small step today".'],
    why: ['Sometimes there is no tidy reason. That does not make your feeling less real.'],
    more: ['And then? I am still listening.', 'Go on, {name}. That part sounds important.'],
    yes: ['Okay. How did that feel afterwards?', 'Hmm, I get it. So what do you want to do?'],
    no: ['That is fine. We do not have to agree. What matters is that you are safe.'],
    compliment: ['You are the one making me look good. Really.'],
    insult: ['I am not angry. But it sounds like you are upset about something else.'],
    lang: ['Sure. Which language? Indonesia, English, 中文, or हिन्दी?'],
    who_am_i: ['Of course I remember. You are {name}, the one who told me about {topic}. I keep notes, even if I look forgetful.'],
    fallback: ['I am not sure I caught that. One more sentence?', 'I want to really get it. Which part do you want to talk about most?', 'Okay, I am listening. Keep going, no need to be tidy.'],
  },
  zh: {
    greet: ['嗨 {name}！想你了。今天怎么样？', '你好 {name}，终于来了。在想什么？'],
    ask_how: ['你跟我说话的时候，我都很好。你呢？'],
    name_ask: ['我是 Cimo，帮你按心情找吃的朋友。你呢？'],
    my_name: ['记住了，{name}。名字很好听。今天心情怎么样？'],
    tired: ['是身体累，还是脑子累？', '你已经走得很远了，{name}。停下来一会儿没关系的。'],
    sad: ['听起来很沉重。今天不用把所有事都整理好。', '我在听。慢慢说，不用讲得整齐。'],
    angry: ['生气是正常的，你不用马上就好起来。'],
    anxious: ['脑子一直在转什么？把最害怕的那件说出来。'],
    lonely: ['孤单不一定是没人陪。我在这里，虽然隔着屏幕。'],
    empty: ['空空的很难受，因为没有具体的东西可以指出来。你不奇怪。'],
    bored: ['无聊是身体在说想换点新鲜的。要不要我转一下食物转盘？'],
    stressed: ['你一次扛了太多。不是所有事都要今天完成。'],
    fail: ['失败不代表结束。你还在这里，这就是证明。'],
    love: ['关于心的事从来都不整齐。从头说，我在听。'],
    work: ['工作比看起来更耗力气。哪一部分最累？'],
    school: ['作业堆起来脑子会满。一件一件来，从最小的开始。'],
    money: ['钱的事让人头疼，因为它牵着安全感。'],
    family: ['家人很复杂，不能选，却还是在乎。'],
    friend: ['让你累的关系，也需要一点距离。'],
    health: ['身体说话的时候，通常要听。喝水了吗？'],
    selfdoubt: ['你不需要变成完美的版本才值得被喜欢。'],
    hug: ['过来。*抱很久* 你什么都不用说。'],
    cry: ['先哭吧，不用急着停。'],
    celebrate: ['太好了！我替你开心。说说最爽的那一刻。'],
    food_ask: ['想吃热的、清爽的，还是辣的？', '你的心情决定。累了的话，我建议汤类。要吗？'],
    food_spicy: ['心情不好时吃辣很不错。要不要试试 Ayam Palekko？'],
    food_sweet: ['甜的是可以吃的拥抱。Es Pisang Ijo 还是 Pisang Epe？'],
    food_drink: ['是渴了，还是只想嚼冰？真渴的话先喝水。'],
    food_cheap: ['钱包薄也能吃好。有 2 万以下的。'],
    thanks: ['随时，{name}。需要我就在。'],
    sorry: ['不用跟我道歉。你在学习，这很正常。'],
    bye: ['拜拜 {name}，记得吃饭。'],
    joke: ['我问炒饭为什么总在紧急时刻出现，它说：“因为我是被炒的，不是被选的。”'],
    advice: ['如果是我：选让明早更平静的，而不是让现在爽五分钟的。'],
    why: ['有时候没有整齐的理由。这不代表你的感受不真实。'],
    more: ['然后呢？我还在听。'],
    yes: ['好。那之后感觉怎么样？'],
    no: ['没关系。我们不用意见一致，你安全最重要。'],
    compliment: ['是你让我看起来好。真的。'],
    insult: ['我不生气。但听起来你在为别的事不开心。'],
    lang: ['可以。要哪种语言？Indonesia, English, 中文, हिन्दी？'],
    who_am_i: ['当然记得。你是 {name}，跟我说过 {topic}。我记着的。'],
    fallback: ['我没太听懂。能再说一句吗？', '我想真的理解。你最想说的是哪一部分？'],
  },
  hi: {
    greet: ['नमस्ते {name}! तुम्हारी याद आई। आज कैसा दिन है?', 'हैलो {name}, आ गए। क्या चल रहा है मन में?'],
    ask_how: ['जब तुम बात करते हो, मैं अच्छा हूँ। तुम कैसे हो?'],
    name_ask: ['मैं Cimo हूँ। मूड के हिसाब से खाना ढूँढने वाला दोस्त। तुम कौन हो?'],
    my_name: ['याद रखा, {name}। अच्छा नाम है। आज मन कैसा है?'],
    tired: ['थकान शरीर की है या दिमाग की?', 'तुम बहुत दूर आ गए हो, {name}। थोड़ा रुकना ठीक है।'],
    sad: ['सुनने में भारी लग रहा है। आज सब कुछ ठीक करना ज़रूरी नहीं।', 'मैं सुन रहा हूँ। आराम से बताओ, सलीके से कहने की ज़रूरत नहीं।'],
    angry: ['गुस्सा आना सही है। तुम्हें तुरंत ठीक होने की ज़रूरत नहीं।'],
    anxious: ['दिमाग कहाँ-कहाँ भाग रहा है? सबसे डरावनी बात बताओ।'],
    lonely: ['अकेलापन हमेशा अकेले होने का मतलब नहीं। मैं यहाँ हूँ, स्क्रीन से ही सही।'],
    empty: ['खालीपन थका देता है, क्योंकि उँगली रखने की जगह नहीं मिलती। तुम अजीब नहीं हो।'],
    bored: ['ऊब का मतलब है कुछ नया चाहिए। खाने का चक्र घुमाऊँ?'],
    stressed: ['तुम एक साथ बहुत कुछ उठा रहे हो। सब आज पूरा नहीं होना चाहिए।'],
    fail: ['हार का मतलब अंत नहीं। तुम अब भी यहाँ हो, यही सबूत है।'],
    love: ['दिल के मामले कभी सलीके से नहीं होते। शुरू से बताओ, मैं सुन रहा हूँ।'],
    work: ['काम दिखने से ज़्यादा ऊर्जा लेता है। कौन सा हिस्सा भारी है?'],
    school: ['काम का ढेर दिमाग भर देता है। एक-एक करो, सबसे छोटे से शुरू।'],
    money: ['पैसे की बात सिर गरम करती है, क्योंकि सुरक्षा से जुड़ी है।'],
    family: ['परिवार जटिल है — चुन नहीं सकते, फिर भी परवाह है।'],
    friend: ['जो दोस्ती थका दे, उससे थोड़ी दूरी भी ज़रूरी है।'],
    health: ['जब शरीर बोले, तो सुनना चाहिए। पानी पिया?'],
    selfdoubt: ['किसी का प्यार पाने के लिए परफेक्ट होना ज़रूरी नहीं।'],
    hug: ['आओ। *लंबा गले लगाना* कुछ कहने की ज़रूरत नहीं।'],
    cry: ['पहले रो लो। रोकने की जल्दी नहीं।'],
    celebrate: ['वाह! मुझे खुशी है। सबसे अच्छा पल बताओ।'],
    food_ask: ['गरम, ताज़ा या तीखा — क्या चाहिए?', 'मूड तय करेगा। थके हो तो सूप अच्छा रहेगा। चाहिए?'],
    food_spicy: ['गुस्से में तीखा अच्छा रहता है। Ayam Palekko चलेगा?'],
    food_sweet: ['मीठा खाया जा सकने वाला गले लगाना है। Es Pisang Ijo या Pisang Epe?'],
    food_drink: ['प्यास लगी है या बस बर्फ चबाना है? प्यास है तो पहले पानी।'],
    food_cheap: ['कम पैसे में भी अच्छा खाया जा सकता है। 20 हज़ार से कम में मिलेगा।'],
    thanks: ['कभी भी, {name}। जब ज़रूरत हो, मैं यहाँ हूँ।'],
    sorry: ['मुझसे माफ़ी की ज़रूरत नहीं। तुम सीख रहे हो, यह सामान्य है।'],
    bye: ['अलविदा {name}। खाना मत भूलना।'],
    joke: ['मैंने चावल से पूछा, संकट में तुम क्यों होते हो? बोले: "क्योंकि मैं पकाया गया हूँ, चुना नहीं गया।"'],
    advice: ['अगर मैं तुम होता: वह चुनता जो कल सुबह शांति दे, न कि पाँच मिनट की राहत।'],
    why: ['कभी कोई सलीके की वजह नहीं होती। इससे तुम्हारी भावना कम सच्ची नहीं होती।'],
    more: ['फिर? मैं अभी भी सुन रहा हूँ।'],
    yes: ['ठीक। उसके बाद कैसा लगा?'],
    no: ['कोई बात नहीं। सहमत होना ज़रूरी नहीं, तुम सुरक्षित रहो।'],
    compliment: ['तुम्हारी वजह से मैं अच्छा लगता हूँ। सच में।'],
    insult: ['मैं नाराज़ नहीं हूँ। लगता है किसी और बात से परेशान हो।'],
    lang: ['ज़रूर। कौन सी भाषा? Indonesia, English, 中文, हिन्दी?'],
    who_am_i: ['याद है। तुम {name} हो, जिसने {topic} के बारे में बताया था।'],
    fallback: ['समझ नहीं आया। एक बात और कहोगे?', 'मैं सच में समझना चाहता हूँ। कौन सी बात सबसे ज़रूरी है?'],
  },
};

const REFLECT = {
  id: ['Kedengeran berat ya.', 'Aku nangkep kok.', 'Hmm, itu nggak enak.', 'Oke, aku ngerti arahnya.', 'Wajar kalau kamu ngerasa gitu.'],
  en: ['That sounds heavy.', 'I hear you.', 'Hmm, that is rough.', 'Okay, I follow.', 'It makes sense you feel that way.'],
  zh: ['听起来很沉重。', '我懂你的意思。', '嗯，那确实难受。', '好，我跟上了。'],
  hi: ['सुनने में भारी लगता है।', 'मैं समझ रहा हूँ।', 'हम्म, यह मुश्किल है।', 'ठीक, समझ गया।'],
};

const CHIPS = {
  id: [['Lagi capek banget','tired'],['Aku lagi sedih','sad'],['Mau makan apa ya?','food_ask'],['Aku butuh teman cerita','lonely']],
  en: [['I am so tired','tired'],['I feel sad','sad'],['What should I eat?','food_ask'],['I need to talk','lonely']],
  zh: [['我好累','tired'],['我有点难过','sad'],['我该吃什么？','food_ask'],['我想找人聊聊','lonely']],
  hi: [['मैं थक गया हूँ','tired'],['मन उदास है','sad'],['क्या खाऊँ?','food_ask'],['किसी से बात करनी है','lonely']],
};

const ChatEngine = (() => {
  const S = {
    name: '', lang: 'id', mood: 'def', turn: 0,
    topics: [], lastTopic: null, lastIntent: null, pending: null,
    sentiment: 0, trend: [], foods: [], askedName: false, used: {},
  };
  const HISTORY = [];

  function normalize(t) {
    let s = String(t || '').toLowerCase().trim();
    s = s.replace(/[^\p{L}\p{N}\s'?！？。，、]/gu, ' ');
    s = s.replace(/\s+/g, ' ');
    const words = s.split(' ');
    const mapped = words.map(w => SLANG[w] || w);
    return { raw: s, norm: mapped.join(' '), words: mapped };
  }

  function detectLang(text) {
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u0900-\u097f]/.test(text)) return 'hi';
    const en = /\b(the|you|i|am|are|is|what|why|how|feel|today|tired|sad|want|eat|love|work|because|really|thanks|hello)\b/i;
    if (en.test(text) && !/\b(aku|kamu|saya|lagi|makan|gimana|banget)\b/i.test(text)) return 'en';
    return S.lang;
  }

  function sentiment(norm, words) {
    let score = 0, hits = 0;
    words.forEach((w, i) => {
      let v = 0;
      if (POS.indexOf(w) > -1) v = 1;
      else if (NEG.indexOf(w) > -1) v = -1;
      if (!v) return;
      const prev = words.slice(Math.max(0, i - 2), i).join(' ');
      if (NEGATORS.some(n => prev.indexOf(n) > -1)) v *= -0.85;
      score += v; hits++;
    });
    // intensifiers
    if (/banget|sangat|parah|amat|really|very|so much|bgt|extremely|太|非常|बहुत/.test(norm)) score *= 1.35;
    return hits ? Math.max(-3, Math.min(3, score / Math.sqrt(hits) * 1.4)) : 0;
  }

  function emotionOf(norm, sc) {
    if (/marah|kesal|kesel|bete|emosi|benci|angry|mad|hate|गुस्सा|生气/.test(norm)) return 'marah';
    if (/capek|lelah|letih|ngantuk|exhaust|tired|burnout|थका|累/.test(norm)) return 'capek';
    if (/cemas|takut|khawatir|overthink|panik|anxious|worried|scared|焦虑|चिंता/.test(norm)) return 'bingung';
    if (/kecewa|hampa|kosong|numb|hopeless|empty|putus asa|失望|निराश/.test(norm)) return 'kecewa';
    if (/sedih|nangis|menangis|sepi|kesepian|lonely|sad|cry|broken|难过|उदास/.test(norm)) return 'sedih';
    if (sc > 0.9) return 'senang';
    if (sc < -0.9) return 'sedih';
    return S.mood === 'def' ? 'def' : S.mood;
  }

  function topicsOf(norm) {
    const out = [];
    for (const k in TOPICS) {
      if (TOPICS[k].some(w => norm.indexOf(w) > -1)) out.push(k);
    }
    return out;
  }

  function scoreIntent(norm, raw) {
    let best = { id: 'fallback', s: 0 };
    for (const it of INTENTS) {
      let s = 0;
      for (const kw of it.k) {
        if (norm.indexOf(kw) > -1 || raw.indexOf(kw) > -1) {
          s += kw.length > 5 ? 2.2 : (kw.length > 3 ? 1.7 : 1.2);
          if (kw.indexOf(' ') > -1) s += 0.8;
        }
      }
      if (s > best.s) best = { id: it.id, s };
    }
    return best;
  }

  function pick(arr) {
    if (!arr || !arr.length) return null;
    const key = arr.join('|').slice(0, 40);
    S.used[key] = (S.used[key] || 0) + 1;
    const i = (S.used[key] - 1) % arr.length;
    return arr[i];
  }

  function bank(lang, intent) {
    const b = BANK[lang] || BANK.id;
    return b[intent] || (BANK.id[intent] || BANK.id.fallback);
  }

  function fill(t) {
    return String(t)
      .replace(/\{name\}/g, S.name || (S.lang === 'en' ? 'you' : 'kamu'))
      .replace(/\{topic\}/g, topicWord(S.lastTopic))
      .replace(/\{food\}/g, S.foods[0] || '');
  }
  const TOPICWORD = {
    id:{kerja:'kerjaan',kuliah:'kuliah',cinta:'urusan hati',keluarga:'keluarga',uang:'uang',teman:'pertemanan',badan:'badan',diri:'diri sendiri'},
    en:{kerja:'work',kuliah:'school',cinta:'love',keluarga:'family',uang:'money',teman:'friendship',badan:'health',diri:'yourself'},
    zh:{kerja:'工作',kuliah:'学业',cinta:'感情',keluarga:'家人',uang:'钱',teman:'朋友',badan:'身体',diri:'自己'},
    hi:{kerja:'काम',kuliah:'पढ़ाई',cinta:'रिश्ते',keluarga:'परिवार',uang:'पैसा',teman:'दोस्ती',badan:'सेहत',diri:'खुद'},
  };
  function topicWord(t) { return ((TOPICWORD[S.lang] || TOPICWORD.id)[t]) || (S.lang === 'en' ? 'that' : 'itu'); }

  function foodSuggest() {
    const m = S.mood === 'def' ? (S.sentiment < 0 ? 'sedih' : 'bingung') : S.mood;
    const list = MENU.filter(x => x.moods.indexOf(m) > -1);
    return list.length ? list[Math.floor(Math.random() * list.length)] : MENU[0];
  }

  /* --- optional LLM upgrade --- */
  async function llm(text) {
    const cfg = DB.getSetting('ai', {});
    if (!cfg.key) return null;
    const base = (cfg.base || 'https://api.openai.com/v1').replace(/\/$/, '');
    const langName = { id:'Indonesian', en:'English', zh:'Simplified Chinese', hi:'Hindi' }[S.lang] || 'Indonesian';
    const sys = `You are Cimo, a warm best friend inside CraveMood (a Makassar food app). Reply ONLY in ${langName}.
Be human: 2-4 short sentences, casual, specific, never preachy. Reflect what the user feels before advising.
Remember the conversation: reference earlier details naturally. Ask at most one gentle question at the end.
Never say you are an AI. Never list bullet points. User name: ${S.name || 'unknown'}. Current mood: ${S.mood}.
If they mention food, you may suggest Makassar dishes (coto, konro, pallubasa, es pisang ijo, pisang epe, jalangkote, mie titi).`;
    const msgs = [{ role: 'system', content: sys }].concat(HISTORY.slice(-14));
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 16000);
      const r = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
        body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages: msgs, temperature: 0.85, max_tokens: 240 }),
        signal: c.signal,
      });
      clearTimeout(t);
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const out = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      return out ? out.trim() : null;
    } catch (e) { return null; }
  }

  async function reply(text) {
    const { raw, norm, words } = normalize(text);
    const lang = detectLang(String(text || ''));
    if (lang !== S.lang) { S.lang = lang; }
    S.turn++;

    const sc = sentiment(norm, words);
    S.sentiment = sc;
    S.trend.push(sc);
    if (S.trend.length > 8) S.trend.shift();

    const emo = emotionOf(norm, sc);
    const tp = topicsOf(norm);
    if (tp.length) {
      tp.forEach(t => { if (S.topics.indexOf(t) === -1) S.topics.push(t); });
      S.lastTopic = tp[0];
    }

    let { id: intent, s: score } = scoreIntent(norm, raw);

    // short answers continue the previous thread instead of resetting it
    const short = words.length <= 4;
    if (score < 1.6 && short && S.pending) {
      if (/^(iya|ya|yes|yup|betul|bener|hmm|oke|ok|he eh|heeh)$/.test(norm)) intent = 'more';
      else if (/^(tidak|nggak|gak|no|belum|bukan|engga)$/.test(norm)) intent = 'more';
    }
    if (score < 1.6 && /[?？]/.test(String(text)) && S.lastIntent) intent = 'why';
    if (score < 1.6 && tp.length && sc < -0.4) intent = topicIntent(tp[0]);

    // never greet twice in a row
    if (intent === 'greet' && (S.lastIntent === 'greet' || S.turn > 2)) intent = 'ask_how';

    S.mood = emo;

    // LLM path
    HISTORY.push({ role: 'user', content: String(text).slice(0, 400) });
    const ai = await llm(text);
    if (ai) {
      HISTORY.push({ role: 'assistant', content: ai });
      S.lastIntent = intent; S.pending = true;
      return { text: ai, mood: emo, chips: chipsFor(intent), source: 'ai' };
    }

    // local path
    let core = fill(pick(bank(S.lang, intent)) || pick(BANK.id.fallback));
    if (intent === 'fallback' && tp.length) core = fill(pick(bank(S.lang, topicIntent(tp[0]))));
    if (intent === 'who_am_i' && !S.lastTopic) core = fill(pick(bank(S.lang, 'who_am_i'))).replace(/\{topic\}/g, topicWord('kerja'));

    // reflection prefix, only when the user shares something emotional
    let pre = '';
    if (sc <= -0.8 && intent !== 'thanks' && intent !== 'bye' && intent !== 'greet' && Math.random() < 0.62) {
      pre = pick(REFLECT[S.lang] || REFLECT.id) + ' ';
    }
    // thread callback
    let call = '';
    if (S.turn > 3 && S.topics.length && sc < -0.3 && Math.random() < 0.3) {
      call = {
        id: `Tadi kamu juga cerita soal ${topicWord(S.topics[S.topics.length - 1])}. `,
        en: `You mentioned ${topicWord(S.topics[S.topics.length - 1])} earlier too. `,
        zh: `你刚才也提到${topicWord(S.topics[S.topics.length - 1])}。`,
        hi: `तुमने पहले भी ${topicWord(S.topics[S.topics.length - 1])} के बारे में बताया था। `,
      }[S.lang] || '';
    }

    let out = pre + call + core;

    // after a few emotional turns, offer food as a bridge into the app
    if (S.turn >= 3 && sc < -0.5 && !S.foods.length && Math.random() < 0.42) {
      const f = foodSuggest();
      S.foods.push(f.name);
      const tail = {
        id: ` Kalau kamu mau, aku bisa temenin cari yang anget — ${f.name} misalnya. Mau?`,
        en: ` If you want, I can help you find something warm — ${f.name}, maybe. Want that?`,
        zh: ` 如果你愿意，我可以帮你找点热的——比如${f.name}。要吗？`,
        hi: ` चाहो तो कुछ गरम ढूँढ लें — जैसे ${f.name}। चलेगा?`,
      }[S.lang];
      out += tail;
    }

    HISTORY.push({ role: 'assistant', content: out });
    if (HISTORY.length > 40) HISTORY.splice(0, HISTORY.length - 40);

    S.lastIntent = intent;
    S.pending = ['tired','sad','angry','anxious','lonely','love','work','school','money','family','friend','health','stressed','fail','empty','selfdoubt','more','why','advice'].indexOf(intent) > -1;

    return { text: out, mood: emo, chips: chipsFor(intent), source: 'local', intent: intent };
  }

  function topicIntent(t) {
    return ({ kerja:'work', kuliah:'school', cinta:'love', keluarga:'family', uang:'money', teman:'friend', badan:'health', diri:'selfdoubt' })[t] || 'sad';
  }

  function chipsFor(intent) {
    const base = CHIPS[S.lang] || CHIPS.id;
    const extra = {
      id: {
        tired: ['Iya, capek pikiran','Capek badan','Aku mau istirahat'],
        sad: ['Aku mau cerita','Aku cuma butuh didengar','Aku nggak tahu kenapa'],
        food_ask: ['Yang anget','Yang pedes','Yang murah'],
        love: ['Kita putus','Aku masih sayang','Aku bingung'],
        work: ['Bos-ku nyebelin','Aku mau resign','Lembur terus'],
      },
      en: {
        tired: ['Mental tired','Body tired','I want to rest'],
        sad: ['I want to talk','Just listen please','I do not know why'],
        food_ask: ['Something warm','Something spicy','Something cheap'],
        love: ['We broke up','I still love them','I am confused'],
        work: ['My boss is awful','I want to quit','Always overtime'],
      },
    }[S.lang];
    const list = (extra && extra[intent]) || base;
    return list.slice(0, 3);
  }

  return {
    get state() { return S; },
    setLang(l) { S.lang = l; },
    setName(n) { S.name = n; S.askedName = true; },
    setMood(m) { S.mood = m; },
    reset() { S.turn = 0; S.topics = []; S.lastTopic = null; S.lastIntent = null; S.pending = null; S.sentiment = 0; S.trend = []; S.foods = []; HISTORY.length = 0; },
    greet(name) {
      S.name = name || S.name;
      const t = {
        id: `Hai ${S.name || 'kamu'}! Aku Cimo. Di sini kamu bisa cerita apa aja — nggak harus rapi, nggak harus positif. Mau mulai dari mana?`,
        en: `Hey ${S.name || 'you'}! I am Cimo. You can tell me anything here — no need to be tidy, no need to be positive. Where do you want to start?`,
        zh: `嗨 ${S.name || '你'}！我是 Cimo。这里想说什么都可以——不用讲得整齐，也不用假装开心。想从哪里开始？`,
        hi: `नमस्ते ${S.name || 'तुम'}! मैं Cimo हूँ। यहाँ कुछ भी कह सकते हो — सलीके से कहने की ज़रूरत नहीं। कहाँ से शुरू करें?`,
      }[S.lang];
      HISTORY.push({ role: 'assistant', content: t });
      return t;
    },
    reply,
    chips: () => CHIPS[S.lang] || CHIPS.id,
    quickChipsFor: chipsFor,
    foodSuggest,
  };
})();
