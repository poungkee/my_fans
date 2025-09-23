import { AppDataSource } from '../config/database';
import { Source } from '../entities/Source';

const logoUrls: Record<string, string> = {
  '연합뉴스': 'https://www.yna.co.kr/images/logo_yna.png',
  '조선일보': 'https://dimg.donga.com/wps/NEWS/IMAGE/2021/04/22/106570674.1.jpg',
  'KBS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/KBS_logo.svg/200px-KBS_logo.svg.png',
  'SBS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/SBS_Logo.svg/200px-SBS_Logo.svg.png',
  'MBC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/MBC_Logo.svg/200px-MBC_Logo.svg.png',
  '한겨레': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Hankyoreh_logo.svg/200px-Hankyoreh_logo.svg.png',
  '중앙일보': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/JoongAng_Ilbo_logo.svg/200px-JoongAng_Ilbo_logo.svg.png',
  '동아일보': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/The_Dong-a_Ilbo_logo.svg/200px-The_Dong-a_Ilbo_logo.svg.png',
  '경향신문': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Kyunghyang_Shinmun_logo.svg/200px-Kyunghyang_Shinmun_logo.svg.png',
  'YTN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/YTN_logo.svg/200px-YTN_logo.svg.png',
  'JTBC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/JTBC_logo.svg/200px-JTBC_logo.svg.png',
  '한국경제': 'https://www.hankyung.com/img/common/logo_main.png',
  '매일경제': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Maeil_Business_logo.svg/200px-Maeil_Business_logo.svg.png',
  '전자신문': 'https://www.etnews.com/images/logo_etnews_2019.png',
  '서울신문': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Seoul_Shinmun_logo.svg/200px-Seoul_Shinmun_logo.svg.png'
};

async function updateSourceLogos() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const sourceRepository = AppDataSource.getRepository(Source);
    const sources = await sourceRepository.find();

    let updated = 0;
    for (const source of sources) {
      const logoUrl = logoUrls[source.name];
      if (logoUrl && !source.logo_url) {
        source.logo_url = logoUrl;
        await sourceRepository.save(source);
        console.log(`Updated logo for ${source.name}: ${logoUrl}`);
        updated++;
      }
    }

    console.log(`Successfully updated ${updated} source logos.`);
  } catch (error) {
    console.error('Error updating source logos:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run the function directly
updateSourceLogos().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

export default updateSourceLogos;