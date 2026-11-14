class Animation {
    constructor(source,frameSelection,frameCondition){
        this.source = source; // files folder path
        this.currentFrame = 0;
        this.frames = [];
        /* 
            (frame)=>{
                return <filesSource>+<fileSuffix>+frame#
                'player_run_'+frame = 'player_run_1', 'player_run_2', ect...
            }
        */
        this.__selectFrameFunction = frameSelection;
        this.__frameSelectionFunction = frameCondition;
    }
    get frame(){
        const framePath = `./Assets/${this.source}/${this.__selectFrameFunction(this.currentFrame)}`;
        return framePath;
    }

}