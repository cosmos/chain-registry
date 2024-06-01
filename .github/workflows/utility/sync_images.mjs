// Purpose:
//   to synchronize the `logo_URIs` and `images` proprties, 
//   and to synchronize linked iamges, where an image for one chain or asset is to be the same as another


// -- THE PLAN --
//
//  Step 1: create `images` array where possible
//
// iterate through every object where images could exist (chains and assets)
//   get list of chains, iterate each chain
//     get list of assets, iterate each asset
//       record the logo_URIs and images properties
//       if logo_URIs
//         if images
//           if logo_URIs::png/svg NOT in images
//             create new image object
//             add png and svg into object
//         else (no images)
//           create images array
//           create new image object
//           add png and svg into object
//       if !logo_URIs AND !images
//         create images array
//         create image object
//         add link to origin asset
//
//  Step 2: pull image data from referenced images
//
//   iterate chains
//     iterate assets
//       iterate images
//         if image_sync,
//           (start recursive function)
//           go to origin 
//           if origin.images
//             if origin.images[0].image_sync
//               return go to origin (recursive call)
//             if origin.images[0].png||svg
//               set first [0] image png&&svg&&theme
//           return
//           (end recursive function)
//               
//  Step 3: Set logo_URIs to first image in images array
//
//   iterate chains
//     iterate assets
//       if images
//         logo_URIs::png&&svg = images[0].png&&svg
//
//  Finish:
//
// write changes to chain_reg


import * as fs from 'fs';
import * as path from 'path';
import * as chain_reg from './chain_registry_local.mjs';

function createImagesArray(){

  //   get list of chains, iterate each chain
//     get list of assets, iterate each asset
//       record the logo_URIs and images properties

  let chainFiles = [];
  let newImageContainingObject;

  let chains = chain_reg.getChains();
  chains.forEach((chainName) => {
    //console.log(chainName);

    let logo_URIs = chain_reg.getFileProperty(chainName, "chain", "logo_URIs");
    //console.log(logo_URIs);
    let images = chain_reg.getFileProperty(chainName, "chain", "images");
    //console.log(images);

    let imageContainingObject = {
      chain_name: chainName,
      logo_URIs: logo_URIs,
      images: images,
      hasUpdated: false
    }

    //console.log(imageContainingObject);
    newImageContainingObject = compareImages(imageContainingObject);

    if(newImageContainingObject.hasUpdated){
      //console.log(newImageContainingObject);
      chain_reg.setFileProperty(chainName, "chain", "images", newImageContainingObject.images);
    }

  });

  let assets = chain_reg.getAssetPointers();
  assets.forEach((assetPointer) => {
    //console.log(assetPointer.base_denom);

    let logo_URIs = chain_reg.getAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "logo_URIs");
    //console.log(logo_URIs);
    let images = chain_reg.getAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "images");
    //console.log(images);

    let imageContainingObject = {
      chain_name: assetPointer.chain_name,
      base_denom: assetPointer.base_denom,
      logo_URIs: logo_URIs,
      images: images,
      hasUpdated: false
    }

    //console.log(imageContainingObject);
    newImageContainingObject = compareImages(imageContainingObject);

    //if(!logo_URIs && !images){
      //newImageContainingObject = createOriginLink(imageContainingObject);
    //}

    //console.log(newImageContainingObject)
    if(newImageContainingObject.hasUpdated){
      chain_reg.setAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "images", newImageContainingObject.images);
    }

  });

}

function compareImages(imageContainingObject) {
  let newImageContainingObject = imageContainingObject;
  if(imageContainingObject.logo_URIs){
    if(imageContainingObject.images){

      //Look for a full match (i.e., png and svg both match)
      let match = false;
      imageContainingObject.images.forEach((image) => {
        if (
          imageContainingObject.logo_URIs.png == image.png && 
          imageContainingObject.logo_URIs.svg == image.svg
        ) {
          match = true;
          return;
        }
      });
      if (match) {
        return newImageContainingObject;
      }

      //Look for a partial match, and update the image object
      for (let i = 0; i < imageContainingObject.images.length; i++) {
        if (
          imageContainingObject.logo_URIs.png == imageContainingObject.images[i].png || 
          imageContainingObject.logo_URIs.svg == imageContainingObject.images[i].svg
        ) {
          newImageContainingObject.images[i] = {
            image_sync: imageContainingObject.images[i].image_sync,
            png: imageContainingObject.logo_URIs.png || imageContainingObject.images[i].png,
            svg: imageContainingObject.logo_URIs.svg || imageContainingObject.images[i].svg,
            theme: imageContainingObject.images[i].theme
          };
          newImageContainingObject.hasUpdated = true;
          return newImageContainingObject;
        }
      }

      //There was no match, so add logo URI files as a new image
      newImageContainingObject.images.push({
        png: imageContainingObject.logo_URIs.png,
        svg: imageContainingObject.logo_URIs.svg
      });
      newImageContainingObject.hasUpdated = true;

    } else {
      newImageContainingObject.images = [{
        png: imageContainingObject.logo_URIs.png,
        svg: imageContainingObject.logo_URIs.svg
      }];
      newImageContainingObject.hasUpdated = true;
    }
  } else {
    if(!imageContainingObject.images && imageContainingObject.base_denom){
      //console.log(imageContainingObject);
      newImageContainingObject = createOriginLink(imageContainingObject);
    }
  }
  return newImageContainingObject;
}

function createOriginLink(imageContainingObject){
  let newImageContainingObject = imageContainingObject;
  let traces = chain_reg.getAssetProperty(
                imageContainingObject.chain_name,
                imageContainingObject.base_denom,
                "traces");
  if(traces){
    newImageContainingObject.images = [
      {
        image_sync: {
          chain_name: traces[0].counterparty.chain_name,
          base_denom: traces[0].counterparty.base_denom
        }
      }
    ];
    newImageContainingObject.hasUpdated = true;
    //console.log(newImageContainingObject);
  }
  return newImageContainingObject;
}


function getLinkedImages(){

//   get list of chains, iterate each chain
//     iterate images
//       pull from origin

  let chains = chain_reg.getChains();
  chains.forEach((chainName) => {
    let images = chain_reg.getFileProperty(chainName, "chain", "images");
    if (!images) { return; }
    images?.forEach((image) => {
      if (!image?.image_sync) {
        return;
      }
      let replacementImage = getLinkedImage(image.image_sync.chain_name, image.image_sync.base_denom);
      if (replacementImage) {
        image.png = replacementImage?.png;
        image.svg = replacementImage?.svg;
        image.theme = replacementImage?.theme;
      }
    });
    chain_reg.setFileProperty(chainName, "chain", "images", images);
  });

//   get list of assets, iterate each asset
//     iterate images
//       pull from origin

  let assets = chain_reg.getAssetPointers();
  assets.forEach((assetPointer) => {
    let images = chain_reg.getAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "images");
    if (!images) { return; }
    images?.forEach((image) => {
      if (!image?.image_sync) {
        return;
      }
      let replacementImage = getLinkedImage(image.image_sync.chain_name, image.image_sync.base_denom);
      if (replacementImage) {
        image.png = replacementImage.png;
        image.svg = replacementImage.svg;
        image.theme = replacementImage.theme;
      }
    });
    chain_reg.setAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "images", images);
  });

}

// finds the URL of the image being referenced--recursive incase the image being referenced references another image
function getLinkedImage(chain_name, base_denom){

  let images;
  if (base_denom) {
    images = chain_reg.getAssetProperty(chain_name, base_denom, "images");
  } else {
    images = chain_reg.getFileProperty(chain_name, "chain", "images")
  }
  if (!images) { return; }
  let image = images[0];
  if (image.image_sync) {
    if (
      base_denom == image.image_sync.base_denom &&
      chain_name == image.image_sync.chain_name
    ) {
      return; //catches self-references
    }
    return getLinkedImage(image.image_sync.chain_name, image.image_sync.base_denom);
  } else {
    return image;
  }
}

function overwriteLogoURIs(){

//   iterate chains
//     iterate assets
//       if images
//         logo_URIs::png&&svg = images[0].png&&svg

 

  let chains = chain_reg.getChains();
  chains.forEach((chainName) => {
    let logo_URIs = chain_reg.getFileProperty(chainName, "chain", "logo_URIs");
    if (!logo_URIs) { return; }
    let images = chain_reg.getFileProperty(chainName, "chain", "images");
    logo_URIs = {
      png: images?.[0]?.png,
      svg: images?.[0]?.svg
    }
    if(images) {
      if(images[0].png || images[0].svg) {
        chain_reg.setFileProperty(chainName, "chain", "logo_URIs", logo_URIs);
      }
    }
  });

  let assets = chain_reg.getAssetPointers();
  assets.forEach((assetPointer) => {
    let logo_URIs = chain_reg.getAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "logo_URIs");
    if (!logo_URIs) { return; }
    let images = chain_reg.getAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "images");
    logo_URIs = {
      png: images?.[0]?.png,
      svg: images?.[0]?.svg
    }
    if(images) {
      if(images[0].png || images[0].svg) {
        chain_reg.setAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "logo_URIs", logo_URIs);
      }
    }
  });

}

function defineImageSync() {

  let assets = chain_reg.getAssetPointers();
  assets.forEach((assetPointer) => {

    let traces = chain_reg.getAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "traces");
    if (!traces) { return; }
    let lastTrace = traces[traces.length - 1];
    let originAssetPointer = {
      chain_name: lastTrace.counterparty.chain_name,
      base_denom: lastTrace.counterparty.base_denom
    }

    let images = chain_reg.getAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "images");
    
    //find out of any of the images are synced with the origin
    for (let i = 0; i < images.length; ++i) {
      if (
        images[i].image_sync?.chain_name === originAssetPointer.chain_name &&
        images[i].image_sync?.base_denom === originAssetPointer.base_denom
      ) {
        return;
      }
    }

    //if there is one, then skip, otherwise,
    //if there is none, the iterate each image, and
    //look for any matches between the image and the origin image

    let originImage = chain_reg.getAssetProperty(originAssetPointer.chain_name, originAssetPointer.base_denom, "images")?.[0];
    if (!originImage) { return; }
    
    let newImages = [];
    let HAS_UPDATED = false;
    images.forEach((image) => {
      let newImage = {};

      if (
        (
          (image.png === originImage.png && originImage.png) ||
          (image.svg === originImage.svg && originImage.svg)
        ) &&
        !image.image_sync
      ) {
        newImage.image_sync = originAssetPointer;
        if (originImage.png) {
          newImage.png = originImage.png;
        }
        if (originImage.svg) {
          newImage.svg = originImage.svg;
        }
        newImage.theme === originImage.theme;
        HAS_UPDATED = true;
      } else {
        newImage = image;
      }
      newImages.push(newImage);
    });

    if (HAS_UPDATED) {
      chain_reg.setAssetProperty(assetPointer.chain_name, assetPointer.base_denom, "images", newImages);
      if (assetPointer.base_denom === "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7") {
        console.log(assetPointer.chain_name);
        console.log(assetPointer.base_denom);
        console.log(images);
        console.log(newImages);
      }
      HAS_UPDATED = false;
    }

  });

}

function main(){
  createImagesArray();
  defineImageSync();
  getLinkedImages();
  overwriteLogoURIs();
}

main()
