class Song {
    constructor(audioPath,coverPath,opts){
        const _opts = {
            audio:['x','y','volume','rate'],
            image:['x','y','anchorX','anchorY','width','height','scale'],
        };
        if(typeof opts != 'object')opts = {aduio:{},image:{}};
        if(opts.audio){
            opts.audio.livePlayer = true;
        }else{
            opts.audio = {
                livePlayer:true,
            };
        }
        this.cover = newImage(coverPath,opts.image ? opts.image : opts);
        this.audio = newSound(audioPath,opts.audio);
    }
    render(){
        push();
        //make audio player -- blah
        pop();
    }
}

