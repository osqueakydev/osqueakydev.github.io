class testObject {
    constructor(x,y,w,h){
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.rendering = new Renderer();
    }
}

class Renderer {
    constructor(){
        this.color = 'white';
        this.outline = [0.1,'black'];
        this.shape = 'rect';
        this.texture = null;
        this.animations = {};
        this.mode = 'basic';
    }
    
}