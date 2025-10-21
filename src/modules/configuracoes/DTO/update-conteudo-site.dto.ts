import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class HeroSlideDto {
  @IsString()
  @IsNotEmpty()
  image: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  subtitle: string;

  @IsString()
  @IsNotEmpty()
  cta: string;

  @IsString()
  @IsNotEmpty()
  alt: string;
}

export class GalleryImageDto {
  @IsString()
  @IsNotEmpty()
  thumbnail: string;

  @IsString()
  @IsNotEmpty()
  full: string;

  @IsString()
  @IsNotEmpty()
  alt: string;

  @IsString()
  @IsNotEmpty()
  title: string;
}

export class ChaletImageDto {
  @IsString()
  @IsNotEmpty()
  src: string;

  @IsString()
  @IsNotEmpty()
  alt: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class SimpleImageDto {
  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsNotEmpty()
  alt: string;
}

export class ConteudoSiteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HeroSlideDto)
  @IsOptional()
  heroSlides?: HeroSlideDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GalleryImageDto)
  @IsOptional()
  galleryImages?: GalleryImageDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChaletImageDto)
  @IsOptional()
  chaletImages?: ChaletImageDto[];

  @ValidateNested()
  @Type(() => SimpleImageDto)
  @IsOptional()
  aboutImage?: SimpleImageDto;

  @ValidateNested()
  @Type(() => SimpleImageDto)
  @IsOptional()
  baptismImage?: SimpleImageDto;
}

export class UpdateConteudoSiteDto {
  @ValidateNested()
  @Type(() => ConteudoSiteDto)
  @IsNotEmpty()
  conteudoSite: ConteudoSiteDto;
}
