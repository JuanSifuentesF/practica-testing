"""
Script de verificación del ExtractorService — ISTQB Study Agent.

Este script verifica que el ExtractorService (BE-05) produce el
JSON estructurado correcto a partir del fixture de texto del
syllabus ISTQB v4.0.

NO usa pytest. Usa aserciones simples de Python para validar:
1. Que el pipeline completo produce un resultado válido.
2. Que el diccionario de tópicos tiene la estructura correcta.
3. Que las horas estimadas se calculan correctamente.
4. Que los valores coinciden con el snapshot esperado.
5. Que el JSON es serializable (listo para Next.js).
6. Que el schema acepta texto extraído corto de PDFs reales.

Ejecución:
    cd backend
    .\\venv\\Scripts\\Activate.ps1
    python -m tests.test_extractor

Salida esperada:
    ✅ Test 1 PASÓ: Pipeline produce resultado válido
    ✅ Test 2 PASÓ: Diccionario tiene estructura correcta
    ✅ Test 3 PASÓ: Horas estimadas correctas
    ✅ Test 4 PASÓ: Snapshot de tópicos coincide
    ✅ Test 5 PASÓ: Spot-check de tópicos clave
    ✅ Test 6 PASÓ: JSON es serializable
    ✅ Test 7 PASÓ: Cálculo de horas con distribución personalizada
    ✅ Test 8 PASÓ: Texto vacío produce resultado vacío
    ✅ Test 9 PASÓ: Schema acepta texto corto de tópico
    ══════════════════════════════════════════════════════
    ✅ TODOS LOS TESTS PASARON (9/9)
"""

import json
import sys

# Agregar el directorio backend al path
sys.path.insert(0, ".")

from app.models.schemas import FullExtractionResponse, KLevelDistribution, TopicInfo
from app.services.extractor import HOURS_PER_K_LEVEL, ExtractorService
from app.services.topic_detector import TopicDetectorService
from tests.fixtures.expected_extraction import (EXPECTED_IS_COMPLETE,
                                                EXPECTED_K_DISTRIBUTION,
                                                EXPECTED_STUDY_HOURS,
                                                EXPECTED_TOPIC_CODES_SET,
                                                EXPECTED_TOTAL_TOPICS,
                                                SPOT_CHECK_TOPICS)
from tests.fixtures.sample_syllabus_text import SAMPLE_SYLLABUS_TEXT


def main() -> None:
    """Ejecuta todos los tests de verificación del ExtractorService."""

    passed = 0
    total = 0

    # ─── Setup: Ejecutar el pipeline con el fixture de texto ───
    # Nota: No usamos full_extraction() porque eso requiere pdf_bytes.
    # En su lugar, ejecutamos los pasos intermedios manualmente.
    topic_detector = TopicDetectorService()
    detection_result = topic_detector.detect(SAMPLE_SYLLABUS_TEXT)

    # Transformar usando los métodos estáticos del ExtractorService
    topics_dict = ExtractorService._build_topics_dict(detection_result.topics)
    estimated_hours = ExtractorService._calculate_study_hours(
        detection_result.level_distribution
    )

    # ═══════════════════════════════════════════════════════════
    # TEST 1: Pipeline produce resultado válido
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        assert detection_result.total_topics > 0, (
            "El pipeline no detectó ningún tópico"
        )
        assert len(topics_dict) > 0, (
            "El diccionario de tópicos está vacío"
        )
        assert len(topics_dict) == detection_result.total_topics, (
            f"El diccionario tiene {len(topics_dict)} entradas pero se "
            f"detectaron {detection_result.total_topics} tópicos"
        )
        print(
            f"✅ Test 1 PASÓ: Pipeline produce resultado válido "
            f"({len(topics_dict)} tópicos en diccionario)"
        )
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 1 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # TEST 2: Diccionario tiene estructura correcta
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        # Verificar que cada entrada del diccionario tiene las claves correctas
        required_keys = {"level_k", "name", "text", "chapter", "section"}
        for code, info in topics_dict.items():
            actual_keys = set(info.keys())
            assert actual_keys == required_keys, (
                f"Tópico {code} tiene claves {actual_keys}, "
                f"esperadas: {required_keys}"
            )
            # Verificar tipos
            assert isinstance(info["level_k"], str), f"{code}: level_k no es str"
            assert isinstance(info["name"], str), f"{code}: name no es str"
            assert isinstance(info["text"], str), f"{code}: text no es str"
            assert isinstance(info["chapter"], int), f"{code}: chapter no es int"
            assert isinstance(info["section"], str), f"{code}: section no es str"

        print("✅ Test 2 PASÓ: Diccionario tiene estructura correcta")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 2 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # TEST 3: Horas estimadas correctas (snapshot)
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        assert estimated_hours == EXPECTED_STUDY_HOURS, (
            f"Horas estimadas: {estimated_hours}, esperadas: {EXPECTED_STUDY_HOURS}"
        )
        # Verificar la fórmula manualmente
        manual_calc = (
            EXPECTED_K_DISTRIBUTION["K1"] * HOURS_PER_K_LEVEL["K1"]
            + EXPECTED_K_DISTRIBUTION["K2"] * HOURS_PER_K_LEVEL["K2"]
            + EXPECTED_K_DISTRIBUTION["K3"] * HOURS_PER_K_LEVEL["K3"]
        )
        assert estimated_hours == round(manual_calc, 1), (
            f"El cálculo no coincide con la fórmula manual: "
            f"{estimated_hours} != {round(manual_calc, 1)}"
        )
        print(f"✅ Test 3 PASÓ: Horas estimadas correctas ({estimated_hours}h)")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 3 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # TEST 4: Snapshot de tópicos coincide
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        actual_codes = set(topics_dict.keys())

        # Verificar total
        assert len(actual_codes) == EXPECTED_TOTAL_TOPICS, (
            f"Total de tópicos: {len(actual_codes)}, "
            f"esperados: {EXPECTED_TOTAL_TOPICS}"
        )

        # Verificar que todos los códigos esperados están presentes
        missing = EXPECTED_TOPIC_CODES_SET - actual_codes
        assert len(missing) == 0, (
            f"Tópicos faltantes vs snapshot: {sorted(missing)}"
        )

        # Verificar que no hay tópicos extras inesperados
        extra = actual_codes - EXPECTED_TOPIC_CODES_SET
        assert len(extra) == 0, (
            f"Tópicos extra no esperados: {sorted(extra)}"
        )

        # Verificar distribución K
        actual_k_dist = detection_result.level_distribution
        assert actual_k_dist == EXPECTED_K_DISTRIBUTION, (
            f"Distribución K: {actual_k_dist}, "
            f"esperada: {EXPECTED_K_DISTRIBUTION}"
        )

        # Verificar completitud
        assert detection_result.is_complete == EXPECTED_IS_COMPLETE, (
            f"is_complete: {detection_result.is_complete}, "
            f"esperado: {EXPECTED_IS_COMPLETE}"
        )

        print(
            f"✅ Test 4 PASÓ: Snapshot de tópicos coincide "
            f"({EXPECTED_TOTAL_TOPICS} tópicos, "
            f"K1={EXPECTED_K_DISTRIBUTION['K1']}, "
            f"K2={EXPECTED_K_DISTRIBUTION['K2']}, "
            f"K3={EXPECTED_K_DISTRIBUTION['K3']})"
        )
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 4 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # TEST 5: Spot-check de tópicos clave
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        for code, expected in SPOT_CHECK_TOPICS.items():
            assert code in topics_dict, (
                f"Tópico clave {code} no encontrado en diccionario"
            )
            topic = topics_dict[code]
            assert topic["level_k"] == expected["level_k"], (
                f"{code}: level_k={topic['level_k']}, "
                f"esperado={expected['level_k']}"
            )
            assert expected["name_contains"] in topic["name"], (
                f"{code}: nombre '{topic['name']}' no contiene "
                f"'{expected['name_contains']}'"
            )
            assert topic["chapter"] == expected["chapter"], (
                f"{code}: chapter={topic['chapter']}, "
                f"esperado={expected['chapter']}"
            )
            assert topic["section"] == expected["section"], (
                f"{code}: section='{topic['section']}', "
                f"esperado='{expected['section']}'"
            )

        print(
            f"✅ Test 5 PASÓ: Spot-check de tópicos clave "
            f"({len(SPOT_CHECK_TOPICS)} tópicos verificados)"
        )
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 5 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # TEST 6: JSON es serializable
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        # Construir el objeto JSON completo como lo haría el router
        full_json = {
            "filename": "test_syllabus.pdf",
            "total_pages": 135,
            "extraction_method": "pdfplumber",
            "topics": topics_dict,
            "total_topics": detection_result.total_topics,
            "level_distribution": detection_result.level_distribution,
            "estimated_study_hours": estimated_hours,
            "warnings": detection_result.warnings,
            "is_complete": detection_result.is_complete,
        }

        # Intentar serializar a JSON — si falla, hay tipos no serializables
        json_str = json.dumps(full_json, ensure_ascii=False)
        assert len(json_str) > 0, "JSON serializado está vacío"

        # Deserializar y verificar que los datos sobreviven el round-trip
        parsed = json.loads(json_str)
        assert parsed["total_topics"] == detection_result.total_topics
        assert parsed["estimated_study_hours"] == estimated_hours
        assert len(parsed["topics"]) == len(topics_dict)

        print(
            f"✅ Test 6 PASÓ: JSON es serializable "
            f"({len(json_str):,} caracteres)"
        )
        passed += 1
    except (AssertionError, TypeError, ValueError) as e:
        print(f"❌ Test 6 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # TEST 7: Cálculo de horas con distribución personalizada
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        # Caso 1: Solo K1
        hours_k1_only = ExtractorService._calculate_study_hours(
            {"K1": 10, "K2": 0, "K3": 0}
        )
        assert hours_k1_only == 5.0, (
            f"10 tópicos K1 × 0.5h = 5.0h, obtenido: {hours_k1_only}"
        )

        # Caso 2: Solo K3
        hours_k3_only = ExtractorService._calculate_study_hours(
            {"K1": 0, "K2": 0, "K3": 4}
        )
        assert hours_k3_only == 6.0, (
            f"4 tópicos K3 × 1.5h = 6.0h, obtenido: {hours_k3_only}"
        )

        # Caso 3: Distribución mixta
        hours_mixed = ExtractorService._calculate_study_hours(
            {"K1": 2, "K2": 3, "K3": 1}
        )
        expected_mixed = (2 * 0.5) + (3 * 1.0) + (1 * 1.5)  # = 5.5
        assert hours_mixed == expected_mixed, (
            f"Distribución mixta: esperado {expected_mixed}, "
            f"obtenido: {hours_mixed}"
        )

        # Caso 4: Distribución vacía
        hours_empty = ExtractorService._calculate_study_hours(
            {"K1": 0, "K2": 0, "K3": 0}
        )
        assert hours_empty == 0.0, (
            f"Distribución vacía debería dar 0.0h, obtenido: {hours_empty}"
        )

        print("✅ Test 7 PASÓ: Cálculo de horas con distribución personalizada")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 7 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # TEST 8: Texto vacío produce resultado vacío
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        empty_result = topic_detector.detect("")
        empty_dict = ExtractorService._build_topics_dict(empty_result.topics)
        empty_hours = ExtractorService._calculate_study_hours(
            empty_result.level_distribution
        )

        assert len(empty_dict) == 0, (
            f"Texto vacío produjo {len(empty_dict)} tópicos"
        )
        assert empty_hours == 0.0, (
            f"Texto vacío debería dar 0.0 horas, obtenido: {empty_hours}"
        )
        assert not empty_result.is_complete, (
            "Texto vacío no debería marcar como completo"
        )

        print("✅ Test 8 PASÓ: Texto vacío produce resultado vacío")
        passed += 1
    except AssertionError as e:
        print(f"❌ Test 8 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # TEST 9: Schema acepta texto corto extraído de PDF real
    # ═══════════════════════════════════════════════════════════
    total += 1
    try:
        response = FullExtractionResponse(
            filename="spanish_syllabus.pdf",
            total_pages=1,
            extraction_method="pdfplumber",
            topics={
                "FL-1.1.1": TopicInfo(
                    level_k="K2",
                    name="Risk analysis",
                    text="riesgo",
                    chapter=1,
                    section="1.1",
                )
            },
            total_topics=1,
            level_distribution=KLevelDistribution(K1=0, K2=1, K3=0),
            estimated_study_hours=1.0,
            warnings=[],
            is_complete=False,
        )

        assert response.topics["FL-1.1.1"].text == "riesgo", (
            "El schema debe aceptar texto corto no vacío de PDFs reales"
        )

        print("✅ Test 9 PASÓ: Schema acepta texto corto de tópico")
        passed += 1
    except Exception as e:
        print(f"❌ Test 9 FALLÓ: {e}")

    # ═══════════════════════════════════════════════════════════
    # RESUMEN
    # ═══════════════════════════════════════════════════════════
    print("═" * 50)
    if passed == total:
        print(f"✅ TODOS LOS TESTS PASARON ({passed}/{total})")
    else:
        print(f"⚠️ {passed}/{total} tests pasaron — revisa los fallos arriba")
        sys.exit(1)

    # ─── Info adicional ───
    print(f"\n📊 Resumen del ExtractorService:")
    print(f"   Tópicos en diccionario: {len(topics_dict)}")
    print(f"   Distribución K: {detection_result.level_distribution}")
    print(f"   Horas estimadas: {estimated_hours}")
    print(f"   Completo: {detection_result.is_complete}")
    print(f"   JSON size: {len(json.dumps(topics_dict)):,} caracteres")
    if detection_result.warnings:
        print(f"   Warnings: {len(detection_result.warnings)}")
        for w in detection_result.warnings:
            print(f"     ⚠️ {w}")


if __name__ == "__main__":
    main()
