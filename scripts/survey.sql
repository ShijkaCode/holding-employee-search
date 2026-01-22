
    -- Create Survey
    INSERT INTO surveys (id, title, description, company_id, status, created_by)
    VALUES ('22222222-2222-2222-2222-222222222222', 'OCSSS Survey 2024', 'Organizational Culture and Employee Satisfaction Survey', '11111111-1111-1111-1111-111111111111', 'active', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    ON CONFLICT (id) DO NOTHING;
    
    DELETE FROM survey_questions WHERE survey_id = '22222222-2222-2222-2222-222222222222';
  
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q1', 'Манай алба/нэгжийн ажиллагчид шаардлагатай тохиолдолд бие биенийхээ ачааллаас хуваалцаж, тухайн ажлын ард хамтдаа гардаг.', 'scale', 'БАГИЙН СЭТГЭЛ', 1, 0, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q2', 'Бид багаар ажиллахад илүү их үр дүнд хүрдэг нь мэдрэгддэг.', 'scale', 'БАГИЙН СЭТГЭЛ', 1, 1, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q3', 'Бид бие биенээ сонсож, хүндэлж, бие биедээ харилцан итгэж, эерэг дулаан харьцааг бий болгож чаддаг', 'scale', 'БАГИЙН СЭТГЭЛ', 1, 2, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q4', 'Бидний ажлын үүрэг роль тодорхой, ойлгомжтой байдаг бөгөөд шаардлагатай тохиолдолд бие биенийгээ орлож ажиллаж чаддаг.', 'scale', 'БАГИЙН СЭТГЭЛ', 1, 3, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q5', 'Би өөрийн ажилтай холбоотой шинэ боломж, асуудлыг шийдвэрлэх арга замыг олж тодорхойлон, бусдадаа ойлгуулан дэмжлэгийг нь авч, оролцоог тэр зүгт чиглүүлж чаддаг.', 'scale', 'МАНЛАЙЛАЛ', 2, 4, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q6', 'Би бусдад бүх боломжоо дайчлан ажиллах урам зоригжсон уур амьсгал, зорилтондоо хүрэх хүсэл, эрмэлзлэлийг бий болгож чаддаг.', 'scale', 'МАНЛАЙЛАЛ', 2, 5, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q7', 'Би өөртөө өндөр шаардлага тавьж, хэцүү төвөгтэй ажлыг хугацаанд нь чанартай гүйцэтгэн, бусдадаа үлгэр дуурайл үзүүлж чаддаг', 'scale', 'МАНЛАЙЛАЛ', 2, 6, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q8', 'Манай компани, ажиллагчдаа тасралтгүй суралцаж, хөгжихөд байнга дэмждэг.', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 7, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q9', 'Манай компанийн ажилтнуудад цаашид өсөх, дэвших, амжилтанд хүрэх боломж эн тэнцүү олгогддог.', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 8, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q10', 'Манай компанид ажилтны өсч хөгжих, дэвжиж дээшлэх нь тухайн хүний хандлага, ур чадвар, ажлын гүйцэтгэлтэй шууд холбоотой байдаг.', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 9, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q11', 'Манай алба/нэгжийн ажиллагчид өөрсдийн мэдлэг, чадвараа бусдадаа дуртайяа хуваалцдаг.', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 10, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q12', 'Тухайн ажлыг хийх хангалттай ур чадвар, мэдлэг манай хамт олонд байдаг тул ажлын гүйцэтгэл дээр асуудал үүсдэггүй.', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 11, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q13', 'Манай алба/нэгжийн ажиллагчдын ур чадвар өмнөх жилтэй харьцуулахад өссөн нь мэдрэгдсэн.', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 12, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q14', 'Сүүлийн 1 жилийн хугацаанд миний мэргэжлийн ур чадвар, гүйцэтгэлд нөлөөлөхүйц ахиц дэвшил гарсан', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 13, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q15', 'Би сүүлийн 1 жилийн хугацаанд одоогийн болон ирээдүйн амжилтад минь чухал шаардлагатай ерөнхий ур чадваруудаа дээшлүүлж чадсан.', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 14, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q16', 'Би сүүлийн 1 жилийн хугацаанд хамтран ажиллагчдынхаа ур чадварыг дээшлүүлж, хөгжүүлэхэд сэтгэл зүтгэл гаргаж, хувь нэмрээ оруулсан.', 'scale', 'МЭРГЭШСЭН ӨНДӨР ЧАДАВХ', 3, 15, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q17', 'Манай компани бүтээлч шийдэл, шинэ санал, санаачилгыг талархан хүлээн авч, шаардлагатайг нь ажил болгон хэрэгжүүлдэг.', 'scale', 'САНАЛ САНААЧИЛГА', 4, 16, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q18', 'Бид шинийг сэдэж, бүтээлч шийдэл гаргаж, аливааг сайжруулах боломжийг цаг ямагт эрэлхийлдэг', 'scale', 'САНАЛ САНААЧИЛГА', 4, 17, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q19', 'Би энэ жил ажлынхаа үр дүнг илүү сайжруулах боломжийг олж, санаачилга гарган ажилласан (үр дүн нь амжилттай болсон эсэхээс үл хамааран).', 'scale', 'САНАЛ САНААЧИЛГА', 4, 18, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q20', 'Би ажилдаа компанийн ажил гэхээс илүүтэйгээр миний ажил-миний амьдралын чухал зүйлсийн нэг гэсэн өнцгөөс ханддаг.', 'scale', 'ӨӨРИЙМСӨГ СЭТГЭЛ', 5, 19, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q21', 'Би хариуцсан ажлаа хийж гүйцэтгэхдээ өөрийн мэдлэг, ур чадвараа бүрэн дүүрэн ашиглаж, ажлаа байнга чанартай хийж гүйцэтгэхийн төлөө байдаг.', 'scale', 'ӨӨРИЙМСӨГ СЭТГЭЛ', 5, 20, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q22', 'Би компаниараа бахархаж, нэр хүндийг нь өндөрт өргөж явахыг байнга эрмэлздэг.', 'scale', 'ӨӨРИЙМСӨГ СЭТГЭЛ', 5, 21, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q23', 'Би компанийнхаа өмч хөрөнгийг хайрлан хамгаалж, эзний ёсоор ханддаг.', 'scale', 'ӨӨРИЙМСӨГ СЭТГЭЛ', 5, 22, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q24', 'Бид алхам тутамдаа М-Си-Эс Группийн үнэт зүйлс, баримтлах зарчим, Ёс зүйн дүрэм-ийг мөрдөж ажилладаг.', 'scale', 'ҮНЭНЧ ШУДАРГА ЗАРЧИМ', 6, 23, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q25', 'Бид цаг үргэлж хууль, дүрэм журмын хүрээнд үйл ажиллагаагаа явуулдаг.', 'scale', 'ҮНЭНЧ ШУДАРГА ЗАРЧИМ', 6, 24, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q26', 'Бид зөв зүйлийг зөв арга замаар хийж үнэнч шударга зарчмыг баримтлан ажилладаг.', 'scale', 'ҮНЭНЧ ШУДАРГА ЗАРЧИМ', 6, 25, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q27', 'Бид харилцагч, хэрэглэгчидтэйгээ үнэнч шударга зарчмыг баримтлан ажилладаг.', 'scale', 'ҮНЭНЧ ШУДАРГА ЗАРЧИМ', 6, 26, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q28', 'Манай компани намайг ажил хөдөлмөрөө аюулгүй бөгөөд үр дүнтэй хийж гүйцэтгэхэд шаардагдах хөдөлмөрийн аюулгүй байдлын орчин, нөхцөлөөр хангадаг.', 'scale', 'ТОГТВОРТОЙ ХӨГЖЛИЙН ЗАРЧИМ', 7, 27, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q29', 'Бид  хүний эрүүл мэнд, аюулгүй байдал, хүрээлэн буй орчинтой холбоотой аюулыг илрүүлэн, гарч болох эрсдэлийг тооцоолон, шаардлагатай арга хэмжээг авч ажиллаж чаддаг.', 'scale', 'ТОГТВОРТОЙ ХӨГЖЛИЙН ЗАРЧИМ', 7, 28, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q30', 'Бид эрүүл мэндээ  хамгаалах, аюулгүй ажиллах, хүрээлэн буй орчноо хамгаалах мэдлэг арга барилд суралцсан', 'scale', 'ТОГТВОРТОЙ ХӨГЖЛИЙН ЗАРЧИМ', 7, 29, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q31', 'Бид байгаль орчиндоо ээлтэй байхыг эрхэмлэн, холбогдох хууль тогтоомж, дүрэм журмыг мөрдөж ажилладаг.', 'scale', 'ТОГТВОРТОЙ ХӨГЖЛИЙН ЗАРЧИМ', 7, 30, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '1.Q32', 'Манай компани олон ургальч үзэл бодол, үндэс угсаа, хүйсийн эрх тэгш байдлыг хүндэлдэг.', 'scale', 'ТОГТВОРТОЙ ХӨГЖЛИЙН ЗАРЧИМ', 7, 31, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q1', 'Компанид шинээр ажилд орохтой холбоотой авилга авсан, бэлэг өгөх, мөнгө төлөхийг шаардсан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 32, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q2', 'Одоогийн ажилдаа үргэлжлүүлэн ажиллах, албан тушаал дэвших, цалин хөлс нэмэгдүүлэхийн тулд бэлэг өгөх, мөнгө төлөхийг шаардсан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 33, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q3', 'Бараа, үйлчилгээ худалдан авахтай холбоотой авилга авсан, ашиг хонжоо гаргасан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 34, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q4', 'Бэлгийн харьцаанд уриалан дуудсан, өдсөн үйлдэл гаргасан, санал болгосон.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 35, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q5', 'Удирдах албан тушаалтны зүгээс өөрийн удирдлаганд ажиллагчидтай албан тушаалын эрх мэдлийг ашиглан зүй бусаар харьцаж, дарамт үзүүлсэн.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 36, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q6', 'Компанид бусадтайгаа зүй бусаар харилцсан, бусдад дарамт шахалт үзүүлсэн.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 37, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q7', 'Олон ургальч үзэл бодол, үндэс угсаа, хүйсийн эрх тэгш байдлыг зөрчсөн.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 38, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q8', 'Хэн нэгэн ажилтан бусдыгаа хууль тогтоомж, дүрэм журам ямар нэг байдлаар зөрчихийг шаардсан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 39, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q9', 'Ажлын байран дээр хүний эрхийг зөрчсөн.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 40, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q10', 'Ажиллагчид, ажил горилогч, бизнесийн түнш, бэлтгэн нийлүүлэгч, худалдан авагчдын хувийн мэдээллийг бизнесийн буюу ажлын бус зорилгоор хувьдаа ашигласан, бусдад задруулсан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 41, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q11', 'Харилцагч, гүйцэтгэгч, бэлтгэн нийлүүлэгчдэд ижил тэгш боломж олгоогүй, тендерийн үйл ажиллагааг шударга бус явуулсан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 42, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q12', 'Хэн нэгэн ажилтан өөрийн албан тушаал, ажил үүргээ ашиглан далдуур өөртөө давуу байдал бий болгосон.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 43, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q13', 'Компанийн өмч хөрөнгийг албан ёсны зөвшөөрөлгүйгээр хувьдаа ашигласан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 44, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q14', 'Компанийн оюуны өмчийг албан ёсны зөвшөөрөлгүйгээр ашигласан, бусдад ашиглуулсан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 45, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q15', 'Бизнесийн стратеги, төлөвлөгөө, ажиллагчдын мэдээлэл, харилцагч, бэлтгэн нийлүүлэгчдийн жагсаалт, санхүүгийн мэдээлэл болон бизнесийн үйл ажиллагааны талаарх олон нийтэд зарлаагүй аливаа мэдээллий...', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 46, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q16', 'Албан бичиг, санхүүгийн болон бусад баримт, тайлан мэдээг хуурамчаар үйлдсэн.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 47, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '2.Q17', 'Ажилд шаардлагатай мэдээллийг санаатайгаар нуун дарагдуулсан.', 'scale', 'ЁСЗҮЙН ДҮРЭМ', 8, 48, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q1', 'Би бусдыгаа манлайлж чаддаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 49, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q2', 'Би мэдлэг чадвартай, тасралтгүй суралцагч', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 50, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q3', 'Би англи хэлний мэдлэгээ ахиулахад байнга анхаарч, суралцдаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 51, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q4', 'Би бусадтай найрсаг, нээлттэй харилцаа үүсгэж, хүрээгээ тэлж, харилцаа холбоогоо хадгалж чаддаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 52, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q5', 'Би бизнесийн ертөнцийн мэдээ, мэдээллийг сонирхож судалдаг, бизнес сэтгэлгээгээ хөгжүүлэхэд анхаардаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 53, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q6', 'Би санаачилгатай байж, шинийг сэдэж, нэвтрүүлэхийг эрэлхийлж ажилладаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 54, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q7', 'Би техник технологийн дэвшлээс хоцрохгүйг хичээж, байнга суралцаж, туршиж, ашигладаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 55, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q8', 'Би авхаалжтай, хурдтай, идэвхтэй байж, аливаад уян хатан ханддаг', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 56, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q9', 'Би өөрийгөө найдвартай, итгэж болох хүн гэдэгт итгэдэг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 57, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q10', 'Би ажилдаа болон компанидаа өөриймсөг хандаж, сэтгэл гарган ажилладаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 58, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q11', 'Би зөв шударга, ёс зүйтэй  байхыг эрхэмлэж, Ёс зүйн дүрмээ мөрдөж ажилладаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 59, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q12', 'Би байгаль орчиндоо ээлтэй, нийгэмдээ тустай аливаа үйл ажиллагаанд хувь нэмрээ оруулдаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 60, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q13', 'Миний болон бусдын аюулгүй байдал надаас ихэнхдээ шалтгаалдаг гэдгийг би ухамсарладаг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 61, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '3.Q14', 'Би эрүүл мэнддээ анхаарч, спортоор хичээллэдэг.', 'scale', 'М-Си-Эс Группийн ажилтны хөгжүүлэх шаардлагатай дүр төрх', 9, 62, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q2', 'Би ажил хайж байгаа бусад хүмүүст манай компанид ажилд орохыг ямар ч эргэлзээгүй санал болгоно.', 'scale', 'Сэтгэл ханамж', 10, 63, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q5', 'Би хамтран ажиллагчиддаа сэтгэл хангалуун байдаг', 'scale', 'Сэтгэл ханамж', 10, 64, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q6', 'Би баг, хамт олондоо хэрэгтэй хүн гэдгээ мэдэрдэг.', 'scale', 'Сэтгэл ханамж', 10, 65, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q8', 'Миний шууд удирдлага итгэл хүлээлгэж болохуйц үлгэр жишээ зөв хүн.', 'scale', 'Сэтгэл ханамж', 10, 66, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q9', 'Миний ажлын гүйцэтгэлийг хэмжих үзүүлэлтүүд надад ойлгомжтой байдаг.', 'scale', 'Сэтгэл ханамж', 10, 67, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q11', 'Би компанийнхаа цалин хөлс тооцох аргачлалыг мэддэг, ойлгодог.', 'scale', 'Сэтгэл ханамж', 10, 68, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q12', 'Миний цалингийн түвшин миний ажлын гүйцэтгэл, үр дүн, ур чадвартай тохирдог.', 'scale', 'Сэтгэл ханамж', 10, 69, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q13', 'Би компаниас олгож буй хөнгөлөлт, хангамжийг мэддэг, шаардлага гарсан тухай бүрт авдаг.', 'scale', 'Сэтгэл ханамж', 10, 70, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q14', 'Би компаниас олгож буй хөнгөлөлт, хангамжинд сэтгэл хангалуун байдаг.', 'scale', 'Сэтгэл ханамж', 10, 71, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q15', 'Манай компанийн алсын хараа, хэтийн зорилго надад тодорхой, ойлгомжтой байдаг.', 'scale', 'Сэтгэл ханамж', 10, 72, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q16', 'Манай алба/нэгжийн жилийн зорилго, зорилт, төлөвлөгөө надад тодорхой, ойлгомжтой байдаг.', 'scale', 'Сэтгэл ханамж', 10, 73, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q18', 'Манай ажлын процедур, зохион байгуулалт ойлгомжтой, цэгцтэй байдаг.', 'scale', 'Сэтгэл ханамж', 10, 74, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q19', 'Миний карьерийн зам тодорхой, ойлгомжтой байдаг.', 'scale', 'Сэтгэл ханамж', 10, 75, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q22', 'Манай компани намайг хэрэгцээтэй, оновчтой, чанартай, үр дүнтэй сургалтуудад хамруулдаг.', 'scale', 'Сэтгэл ханамж', 10, 76, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q1', 'Хийж байгаа ажил маань миний ур чадварыг сайн гаргаж, нөөц боломжийг минь сайн ашигладаг.', 'scale', 'Engagement', 11, 77, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q3', 'Би компаниараа бахархдаг.', 'scale', 'Engagement', 11, 78, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q4', 'Хийж байгаа ажил маань миний зорилго, хүсэл сонирхолтой нийцдэг.', 'scale', 'Engagement', 11, 79, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q7', 'Миний шууд удирдлага намайг хариуцсан ажлаа хамгийн сайнаараа хийж гүйцэтгэхэд урам зориг, ажил мэргэжлийн зөвлөмж өгч, байнга дэмжиж ажилладаг', 'scale', 'Engagement', 11, 80, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q10', 'Миний ажлын гүйцэтгэл шударгаар үнэлэгддэг.', 'scale', 'Engagement', 11, 81, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q17', 'Миний ажлын төлөвлөгөө компанийн бизнесийн зорилт, төлөвлөгөөтэй уялддаг.', 'scale', 'Engagement', 11, 82, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q20', 'Би карьерийн өсөлтийнхөө талаар өөртөө итгэлтэй байдаг.', 'scale', 'Engagement', 11, 83, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '5.Q21', 'Манай компани намайг өөрийн ур чадвар, мэдлэгээ сайжруулах болон шинээр олж авах боломж, нөхцөлөөр хангадаг.', 'scale', 'Engagement', 11, 84, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '6.Q1', 'А. Бүх хүчин зүйлийг харгалзан үзвэл Та КОМПАНИДАА хэр зэрэг сэтгэл хангалуун байна вэ.', 'scale', 'NPS', 12, 85, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '6.Q2', 'Б. Бүх хүчин зүйлийг харгалзан үзвэл Та АЖИЛДАА хэр зэрэг сэтгэл хангалуун байна вэ', 'scale', 'NPS', 12, 86, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '7.Q1', 'А. Та КОМПАНИДАА ажиллаж буй шалтгаанаа 4-1 гэсэн үнэлгээгээр дүгнэнэ үү.', 'scale', 'Сэтгэл ханамж', 13, 87, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', '7.Q2', 'Б. Та хийж  буй АЖЛАА  4-1 гэсэн үнэлгээгээр дүгнэнэ үү.', 'scale', 'Сэтгэл ханамж', 13, 88, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', 'Group', 'Та аль нэгжид харьяалагддаг вэ?', 'text', 'Сэтгэл ханамж', 13, 89, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', 'Years', 'Та М-Си-Эс Группт хэдэн жил ажиллаж байна вэ?', 'text', 'Сэтгэл ханамж', 13, 90, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', 'BirthYear', 'Та хэдэн онд төрсөн бэ?', 'text', 'Сэтгэл ханамж', 13, 91, null);
      
      INSERT INTO survey_questions (survey_id, question_code, question_text, type, section_name, section_order, question_order, options)
      VALUES ('22222222-2222-2222-2222-222222222222', 'Gender', 'Таны хүйс', 'text', 'Сэтгэл ханамж', 13, 92, null);
      